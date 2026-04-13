<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Mail\PasswordResetMail;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * Register a new user and return a token.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $user->assignRole('user');

        $token = $user->createToken('api-token')->plainTextToken;

        $this->activityLog->log('user.registered', "User {$user->name} registered", $user);

        return response()->json([
            'message' => 'Registration successful.',
            'data' => new UserResource($user->load('roles')),
            'token' => $token,
        ], 201);
    }

    /**
     * Login and return a token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        $this->activityLog->log('user.login', "User {$user->name} logged in", $user);

        return response()->json([
            'message' => 'Login successful.',
            'data' => new UserResource($user->load('roles')),
            'token' => $token,
        ]);
    }

    /**
     * Logout and revoke the current token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        $this->activityLog->log('user.logout', 'User logged out', $request->user());

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the current authenticated user.
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'data' => new UserResource($request->user()->load('roles')),
        ]);
    }

    /**
     * Send a password reset link to the given email address.
     * Always returns a generic success response to prevent email enumeration.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if ($user) {
            $token = Password::createToken($user);

            $resetUrl = rtrim(config('app.url'), '/') . '/reset-password'
                . '?token=' . $token
                . '&email=' . urlencode($user->email);

            Mail::to($user->email)->queue(new PasswordResetMail($resetUrl, $user->name));
        }

        return response()->json([
            'message' => 'If that email address is registered, a password reset link has been sent.',
        ]);
    }

    /**
     * Reset the user's password using the provided token.
     * Revokes all existing Sanctum tokens on success.
     */
    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();

                // Revoke all existing tokens so every session must re-authenticate.
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password has been reset successfully. Please log in with your new password.',
        ]);
    }
}
