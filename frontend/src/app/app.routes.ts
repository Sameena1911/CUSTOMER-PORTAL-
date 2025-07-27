import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { HomeComponent } from './home/home.component';
import { ProfileComponent } from './profile/profile.component';
import { InquiryComponent } from './inquiry/inquiry.component';
import { SalesOrderComponent } from './sales-order/sales-order.component';
import { DeliveryComponent } from './delivery/delivery.component';
import { FinancialComponent } from './financial/financial.component';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'home', component: HomeComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'inquiries', component: InquiryComponent, canActivate: [authGuard] },
  { path: 'sales-orders', component: SalesOrderComponent, canActivate: [authGuard] },
  { path: 'deliveries', component: DeliveryComponent, canActivate: [authGuard] },
  { path: 'financial', component: FinancialComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' }
];
