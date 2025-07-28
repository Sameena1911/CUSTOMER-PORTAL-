import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  // Transaction statistics
  inquiryStats = {
    total: 0,
    recentCount: 0,
    loading: false
  };

  orderStats = {
    total: 0,
    active: 0,
    loading: false
  };

  deliveryStats = {
    total: 0,
    inTransit: 0,
    loading: false
  };

  financialStats = {
    totalOutstanding: '0',
    overdueCount: 0,
    loading: false
  };

  // Profile data
  profile: any = null;
  profileLoading = false;

  customerId: string | null = null;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.customerId = localStorage.getItem('customerId');
    this.loadDashboardData();
  }

  loadDashboardData() {
    if (this.customerId) {
      this.loadProfile();
      this.loadInquiryStats();
      this.loadOrderStats();
      this.loadDeliveryStats();
      this.loadFinancialStats();
    }
  }

  loadProfile() {
    if (!this.customerId) return;

    this.profileLoading = true;
    
    this.http.get<any>(`http://localhost:3000/api/customer/profile/${this.customerId}`)
      .subscribe({
        next: (data) => {
          this.profile = data.profile || data;
          this.profileLoading = false;
          console.log('Profile loaded successfully:', this.profile);
        },
        error: (error) => {
          console.error('Error loading profile:', error);
          this.profileLoading = false;
        }
      });
  }

  loadInquiryStats() {
    if (!this.customerId) return;

    this.inquiryStats.loading = true;

    this.http.get<any>(`http://localhost:3000/api/customer/inquiries/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.inquiryStats.loading = false;
          if (response.success && response.inquiries) {
            const inquiries = response.inquiries;
            
            // Calculate recent inquiries (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentInquiries = inquiries.filter((inquiry: any) => {
              if (inquiry.erdat && inquiry.erdat !== 'N/A') {
                const inquiryDate = this.parseDate(inquiry.erdat);
                return inquiryDate >= thirtyDaysAgo;
              }
              return false;
            });
            
            this.inquiryStats = {
              total: inquiries.length,
              recentCount: recentInquiries.length,
              loading: false
            };
          } else {
            this.inquiryStats = {
              total: 0,
              recentCount: 0,
              loading: false
            };
          }
        },
        error: (error) => {
          console.error('Error loading inquiry stats:', error);
          this.inquiryStats = {
            total: 0,
            recentCount: 0,
            loading: false
          };
        }
      });
  }

  loadOrderStats() {
    if (!this.customerId) return;

    this.orderStats.loading = true;

    this.http.get<any>(`http://localhost:3000/api/customer/sales-orders/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.orderStats.loading = false;
          if (response.success && response.salesOrders) {
            const salesOrders = response.salesOrders;
            
            // Count active orders (assuming OR, ZOR are active order types)
            const activeOrders = salesOrders.filter((order: any) => 
              order.auart === 'OR' || order.auart === 'ZOR'
            );
            
            this.orderStats = {
              total: salesOrders.length,
              active: activeOrders.length,
              loading: false
            };
          } else {
            this.orderStats = {
              total: 0,
              active: 0,
              loading: false
            };
          }
        },
        error: (error) => {
          console.error('Error loading sales order stats:', error);
          this.orderStats = {
            total: 0,
            active: 0,
            loading: false
          };
        }
      });
  }

  loadDeliveryStats() {
    if (!this.customerId) return;

    this.deliveryStats.loading = true;

    this.http.get<any>(`http://localhost:3000/api/customer/deliveries/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.deliveryStats.loading = false;
          if (response.success && response.deliveries) {
            const deliveries = response.deliveries;
            
            // Count deliveries in transit (assuming LF, LO, ZLF are in transit)
            const inTransitDeliveries = deliveries.filter((delivery: any) => 
              ['LF', 'LO', 'ZLF'].includes(delivery.lfart)
            );
            
            this.deliveryStats = {
              total: deliveries.length,
              inTransit: inTransitDeliveries.length,
              loading: false
            };
          } else {
            this.deliveryStats = {
              total: 0,
              inTransit: 0,
              loading: false
            };
          }
        },
        error: (error) => {
          console.error('Error loading delivery stats:', error);
          this.deliveryStats = {
            total: 0,
            inTransit: 0,
            loading: false
          };
        }
      });
  }

  loadFinancialStats() {
    if (!this.customerId) return;

    this.financialStats.loading = true;

    // Use payment aging endpoint to get real financial data
    this.http.get<any>(`http://localhost:3000/api/customer/payment-aging/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.financialStats.loading = false;
          if (response.success && response.paymentAging && response.paymentAging.length > 0) {
            let totalOutstanding = 0;
            let overdueCount = 0;
            const currentDate = new Date();

            response.paymentAging.forEach((item: any) => {
              // Parse outstanding amount
              const amount = parseFloat(item.dmbtr) || 0;
              totalOutstanding += amount;

              // Check if overdue based on aging buckets
              // If any amount is in aging buckets (bucket1, bucket2, etc.), it's overdue
              const bucket1 = parseFloat(item.bucket1) || 0;
              const bucket2 = parseFloat(item.bucket2) || 0;
              const bucket3 = parseFloat(item.bucket3) || 0;
              const bucket4 = parseFloat(item.bucket4) || 0;

              if (bucket1 > 0 || bucket2 > 0 || bucket3 > 0 || bucket4 > 0) {
                overdueCount++;
              }
            });

            this.financialStats = {
              totalOutstanding: totalOutstanding.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              }),
              overdueCount: overdueCount,
              loading: false
            };
          } else {
            this.financialStats = {
              totalOutstanding: '0.00',
              overdueCount: 0,
              loading: false
            };
          }
        },
        error: (error) => {
          console.error('Error loading financial stats:', error);
          this.financialStats = {
            totalOutstanding: '0.00',
            overdueCount: 0,
            loading: false
          };
        }
      });
  }

  logout() {
    // Clear stored user data
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('customerId');
    
    console.log('Logging out...');
    
    // Redirect to login page
    this.router.navigate(['/login']);
  }

  // Transaction navigation methods
  navigateToInquiries() {
    console.log('Navigating to inquiries...');
    this.router.navigate(['/inquiries']);
  }

  navigateToSalesOrders() {
    console.log('Navigating to sales orders...');
    this.router.navigate(['/sales-orders']);
  }

  navigateToDeliveries() {
    console.log('Navigating to deliveries...');
    this.router.navigate(['/deliveries']);
  }

  navigateToFinancial() {
    console.log('Navigating to financial...');
    this.router.navigate(['/financial']);
  }

  // Quick action methods
  createNewInquiry() {
    console.log('Creating new inquiry...');
    // TODO: Implement new inquiry creation
    alert('New inquiry creation will be implemented next');
  }

  contactSupport() {
    console.log('Contacting support...');
    // TODO: Implement support contact
    alert('Support contact will be implemented next');
  }

  downloadReports() {
    console.log('Downloading reports...');
    // TODO: Implement report download
    alert('Report download will be implemented next');
  }

  // Helper method to parse SAP date format
  parseDate(dateStr: string): Date {
    // Handle SAP date format (DD/MM/YYYY)
    if (dateStr && dateStr !== 'N/A') {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        // Convert DD/MM/YYYY to MM/DD/YYYY for JavaScript Date
        return new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
      }
    }
    return new Date();
  }
}
