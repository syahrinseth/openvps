<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserManagementController extends Controller
{
    public function __construct(
        protected ActivityLogService $activityLog,
    ) {}

    /**
     * List all users (admin only).
     */
    public function index(Request $request): JsonResponse
    {
        $users = User::with('roles')
            ->withCount('servers')
            ->latest()
            ->paginate($request->input('per_page', 15));

        return response()->json(UserResource::collection($users)->response()->getData(true));
    }

    /**
     * Create a new user (admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['sometimes', 'string', 'exists:roles,name'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        if (isset($validated['role'])) {
            $user->assignRole($validated['role']);
        } else {
            $user->assignRole('user');
        }

        $this->activityLog->log(
            'user.created',
            "User '{$user->name}' was created by admin",
            $request->user(),
        );

        return response()->json([
            'message' => 'User created successfully.',
            'user' => new UserResource($user->load('roles')),
        ], 201);
    }

    /**
     * Show user details (admin only).
     */
    public function show(User $user): JsonResponse
    {
        $user->load('roles')->loadCount('servers');

        return response()->json([
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Update a user (admin only).
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        $this->activityLog->log(
            'user.updated',
            "User '{$user->name}' was updated by admin",
            $request->user(),
        );

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => new UserResource($user->fresh()->load('roles')),
        ]);
    }

    /**
     * Delete a user (admin only).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'You cannot delete your own account.',
            ], 403);
        }

        $this->activityLog->log(
            'user.deleted',
            "User '{$user->name}' was deleted by admin",
            $request->user(),
        );

        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }

    /**
     * Assign a role to a user (admin only).
     */
    public function assignRole(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $user->syncRoles([$validated['role']]);

        $this->activityLog->log(
            'user.role_assigned',
            "Role '{$validated['role']}' assigned to user '{$user->name}'",
            $request->user(),
        );

        return response()->json([
            'message' => 'Role assigned successfully.',
            'user' => new UserResource($user->fresh()->load('roles')),
        ]);
    }
}
