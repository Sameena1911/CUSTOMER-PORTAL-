import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.css'
})
export class DeliveryComponent implements OnInit {

  deliveries: any[] = [];
  filteredDeliveries: any[] = [];
  customerId: string | null = null;
  loading: boolean = false;
  error: string | null = null;
  showFilters: boolean = false;
  totalCount: number = 0;

  // Filter properties
  filters = {
    deliveryDocument: '',
    deliveryType: '',
    shippingPoint: '',
    route: '',
    storageLocation: '',
    salesUnit: ''
  };

  // Delivery type descriptions
  private deliveryTypeDescriptions: { [key: string]: string } = {
    'LF': 'Standard Delivery',
    'LO': 'Outbound Delivery',
    'ZLF': 'Custom Delivery',
    'ZDL': 'Direct Delivery',
    'EL': 'Express Delivery',
    'NL': 'Normal Delivery'
  };

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.customerId = localStorage.getItem('customerId');
    if (!this.customerId) {
      console.error('No customer ID found, redirecting to login');
      this.router.navigate(['/login']);
      return;
    }
    this.loadDeliveryData();
  }

  loadDeliveryData() {
    if (!this.customerId) return;

    this.loading = true;
    this.error = null;

    console.log('Loading delivery data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/deliveries/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('Delivery data response:', response);
          this.loading = false;
          
          if (response.success && response.deliveries) {
            this.deliveries = response.deliveries;
            this.applyFilters();
            console.log(`Loaded ${this.deliveries.length} delivery records`);
          } else {
            this.deliveries = [];
            this.filteredDeliveries = [];
            this.totalCount = 0;
            this.error = response.error || 'No delivery data available';
          }
        },
        error: (error) => {
          console.error('Error loading delivery data:', error);
          this.loading = false;
          this.deliveries = [];
          this.filteredDeliveries = [];
          this.totalCount = 0;
          this.error = error.error?.error || 'Failed to load delivery data';
        }
      });
  }

  refreshData() {
    this.loadDeliveryData();
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  applyFilters() {
    this.filteredDeliveries = this.deliveries.filter(delivery => {
      // Delivery Document filter
      if (this.filters.deliveryDocument && 
          !delivery.vbeln.toLowerCase().includes(this.filters.deliveryDocument.toLowerCase())) {
        return false;
      }

      // Delivery Type filter
      if (this.filters.deliveryType && delivery.lfart !== this.filters.deliveryType) {
        return false;
      }

      // Shipping Point filter
      if (this.filters.shippingPoint && 
          !delivery.vstel.toLowerCase().includes(this.filters.shippingPoint.toLowerCase())) {
        return false;
      }

      // Route filter
      if (this.filters.route && 
          !delivery.route.toLowerCase().includes(this.filters.route.toLowerCase())) {
        return false;
      }

      // Storage Location filter
      if (this.filters.storageLocation && 
          !delivery.lgort.toLowerCase().includes(this.filters.storageLocation.toLowerCase())) {
        return false;
      }

      // Sales Unit filter
      if (this.filters.salesUnit && 
          !delivery.vrkme.toLowerCase().includes(this.filters.salesUnit.toLowerCase())) {
        return false;
      }

      return true;
    });

    this.totalCount = this.filteredDeliveries.length;
    console.log(`Filtered to ${this.totalCount} delivery records`);
  }

  clearFilters() {
    this.filters = {
      deliveryDocument: '',
      deliveryType: '',
      shippingPoint: '',
      route: '',
      storageLocation: '',
      salesUnit: ''
    };
    this.applyFilters();
  }

  // Helper methods for filter options
  getUniqueDeliveryTypes(): string[] {
    const types = [...new Set(this.deliveries.map(delivery => delivery.lfart))];
    return types.filter(type => type && type !== 'N/A');
  }

  getUniqueShippingPoints(): string[] {
    const points = [...new Set(this.deliveries.map(delivery => delivery.vstel))];
    return points.filter(point => point && point !== 'N/A');
  }

  getUniqueRoutes(): string[] {
    const routes = [...new Set(this.deliveries.map(delivery => delivery.route))];
    return routes.filter(route => route && route !== 'N/A');
  }

  getUniqueStorageLocations(): string[] {
    const locations = [...new Set(this.deliveries.map(delivery => delivery.lgort))];
    return locations.filter(location => location && location !== 'N/A');
  }

  // Helper method to get delivery type description
  getDeliveryTypeDescription(type: string): string {
    return this.deliveryTypeDescriptions[type] || type;
  }

  // Helper method to format date
  formatDate(dateString: string): string {
    if (!dateString || dateString === 'N/A') return 'N/A';
    
    // If it's already in a readable format, return as is
    if (dateString.includes('/') || dateString.includes('-')) {
      return dateString;
    }
    
    // If it's in YYYYMMDD format, convert it
    if (dateString.length === 8 && /^\d+$/.test(dateString)) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${day}/${month}/${year}`;
    }
    
    return dateString;
  }

  // Helper method to parse date for filtering
  parseDate(dateString: string): Date {
    if (!dateString || dateString === 'N/A') return new Date(0);
    
    // If it's in YYYYMMDD format
    if (dateString.length === 8 && /^\d+$/.test(dateString)) {
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateString.substring(6, 8));
      return new Date(year, month, day);
    }
    
    // Try to parse as normal date
    return new Date(dateString);
  }

  // Helper methods for statistics
  getActiveDeliveryCount(): number {
    // Consider LF, LO, ZLF as active delivery types
    return this.filteredDeliveries.filter(delivery => 
      ['LF', 'LO', 'ZLF'].includes(delivery.lfart)
    ).length;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.deliveryDocument) count++;
    if (this.filters.deliveryType) count++;
    if (this.filters.shippingPoint) count++;
    if (this.filters.route) count++;
    if (this.filters.storageLocation) count++;
    if (this.filters.salesUnit) count++;
    return count;
  }

  // Helper method to get total delivered quantity
  getTotalDeliveredQuantity(): number {
    return this.filteredDeliveries.reduce((total, delivery) => {
      const quantity = parseFloat(delivery.lfimg) || 0;
      return total + quantity;
    }, 0);
  }
}
