import type { Routes } from '@angular/router';

class AdminIndexPage {}
class AdminUsersPage {}
class AdminUserPage {}

export const ADMIN_ROUTES: Routes = [
  { path: '', component: AdminIndexPage },
  { path: 'users', component: AdminUsersPage },
  { path: 'users/:userId', component: AdminUserPage },
];

