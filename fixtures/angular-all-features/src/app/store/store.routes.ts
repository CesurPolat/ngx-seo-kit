import type { Routes } from '@angular/router';

class StoreIndexPage {}
class CartPage {}

const STORE_ROUTES: Routes = [
  { path: '', component: StoreIndexPage },
  { path: 'cart', component: CartPage },
];

export default STORE_ROUTES;

