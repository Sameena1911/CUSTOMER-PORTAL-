import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profile: any = null;
  loading = false;
  error: string | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.loading = true;
    this.error = null;
    
    // Get the actual logged-in customer ID from localStorage
    const customerId = localStorage.getItem('customerId') || '0000000001';
    console.log('Loading profile for customer ID:', customerId);
    
    this.http.get<any>(`http://localhost:3000/api/customer/profile/${customerId}`)
      .subscribe({
        next: (data) => {
          // If the response has a profile property, use that, otherwise use the data directly
          this.profile = data.profile || data;
          this.loading = false;
          console.log('Profile loaded successfully:', this.profile);
        },
        error: (error) => {
          console.error('Error loading profile:', error);
          this.error = 'Failed to load profile information';
          this.loading = false;
        }
      });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  editProfile() {
    // TODO: Implement edit profile functionality
    alert('Edit Profile functionality will be implemented in future updates');
  }
}