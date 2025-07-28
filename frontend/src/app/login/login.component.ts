import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient
  ) {
    this.loginForm = this.fb.group({
      cust_id: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (this.loginForm.valid) {
      this.loading = true;
      const loginData = this.loginForm.value;
      console.log('Sending login request:', loginData);
      
      this.http.post('http://localhost:3000/api/login', loginData).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            console.log('Login Success:', res.message);
            console.log('SAP Response:', res.sapResponse);
            
            // Store user data if needed
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('customerId', loginData.cust_id || '');
            
            // Navigate to home page
            this.router.navigate(['/home']);
          } else {
            console.log('Login Failed:', res.message);
            alert('Login failed: ' + (res.message || 'Invalid credentials'));
          }
        },
        error: (err: any) => {
          this.loading = false;
          console.error('Server Error:', err);
          alert('Server error occurred. Please try again.');
        }
      });
    } else {
      alert('Please fill in all required fields');
    }
  }

}
