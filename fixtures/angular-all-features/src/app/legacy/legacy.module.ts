import { NgModule } from '@angular/core';
import { RouterModule, type Routes } from '@angular/router';

class LegacyIndexPage {}
class LegacyDetailsPage {}

const LEGACY_ROUTES: Routes = [
  { path: '', component: LegacyIndexPage },
  { path: 'details', component: LegacyDetailsPage },
];

@NgModule({
  imports: [RouterModule.forChild(LEGACY_ROUTES)],
})
export class LegacyModule {}

