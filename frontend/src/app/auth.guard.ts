import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  
  if (isLoggedIn === 'true') {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
