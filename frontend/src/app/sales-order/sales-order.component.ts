import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface SalesOrderData {
  vbeln: string;  // Sales Document
  auart: string;  // Document Type
  vkorg: string;  // Sales Organization
  vtweg: string;  // Distribution Channel
  kunnr: string;  // Customer Number
  vrkme: string;  // Sales Unit
  arktx: string;  // Material Description
}

@Component({
  selector: 'app-sales-order',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-order.component.html',
  styleUrl: './sales-order.component.css'
})
export class SalesOrderComponent implements OnInit {
  salesOrders: SalesOrderData[] = [];
  filteredSalesOrders: SalesOrderData[] = [];
  loading = false;
  error: string | null = null;
  customerId: string | null = null;
  totalCount = 0;

  // Filter properties
  showFilters = false;
  filters = {
    salesDocument: '',
    documentType: '',
    salesOrganization: '',
    distributionChannel: '',
    materialDescription: '',
    salesUnit: ''
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.customerId = localStorage.getItem('customerId');
    if (this.customerId) {
      this.loadSalesOrderData();
    } else {
      this.error = 'Customer ID not found. Please login again.';
    }
  }

  loadSalesOrderData() {
    if (!this.customerId) return;

    this.loading = true;
    this.error = null;

    this.http.get<any>(`http://localhost:3000/api/customer/sales-orders/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.salesOrders = response.salesOrders || [];
            this.filteredSalesOrders = [...this.salesOrders];
            this.totalCount = response.totalCount || 0;
            console.log('Sales order data loaded successfully:', this.salesOrders);
          } else {
            this.error = response.message || 'Failed to load sales order data';
            this.salesOrders = [];
            this.filteredSalesOrders = [];
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Error loading sales order data:', error);
          this.error = error.error?.message || 'Failed to connect to server';
          this.salesOrders = [];
          this.filteredSalesOrders = [];
        }
      });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  refreshData() {
    this.loadSalesOrderData();
  }

  getDocumentTypeDescription(auart: string): string {
    switch (auart) {
      case 'OR': return 'Standard Order';
      case 'KA': return 'Contract';
      case 'KB': return 'Scheduling Agreement';
      case 'ZOR': return 'Custom Order';
      case 'TA': return 'Exchange Order';
      default: return auart;
    }
  }

  // Filter functions
  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  applyFilters() {
    this.filteredSalesOrders = this.salesOrders.filter(order => {
      // Sales Document filter
      if (this.filters.salesDocument && 
          !order.vbeln.toLowerCase().includes(this.filters.salesDocument.toLowerCase())) {
        return false;
      }

      // Document Type filter
      if (this.filters.documentType && order.auart !== this.filters.documentType) {
        return false;
      }

      // Sales Organization filter
      if (this.filters.salesOrganization && 
          !order.vkorg.toLowerCase().includes(this.filters.salesOrganization.toLowerCase())) {
        return false;
      }

      // Distribution Channel filter
      if (this.filters.distributionChannel && 
          !order.vtweg.toLowerCase().includes(this.filters.distributionChannel.toLowerCase())) {
        return false;
      }

      // Material Description filter
      if (this.filters.materialDescription && 
          !order.arktx.toLowerCase().includes(this.filters.materialDescription.toLowerCase())) {
        return false;
      }

      // Sales Unit filter
      if (this.filters.salesUnit && 
          !order.vrkme.toLowerCase().includes(this.filters.salesUnit.toLowerCase())) {
        return false;
      }

      return true;
    });

    this.totalCount = this.filteredSalesOrders.length;
  }

  clearFilters() {
    this.filters = {
      salesDocument: '',
      documentType: '',
      salesOrganization: '',
      distributionChannel: '',
      materialDescription: '',
      salesUnit: ''
    };
    this.filteredSalesOrders = [...this.salesOrders];
    this.totalCount = this.salesOrders.length;
  }

  getUniqueDocumentTypes(): string[] {
    const types = [...new Set(this.salesOrders.map(order => order.auart))];
    return types.filter(type => type && type !== 'N/A');
  }

  getUniqueSalesOrganizations(): string[] {
    const orgs = [...new Set(this.salesOrders.map(order => order.vkorg))];
    return orgs.filter(org => org && org !== 'N/A');
  }

  getUniqueDistributionChannels(): string[] {
    const channels = [...new Set(this.salesOrders.map(order => order.vtweg))];
    return channels.filter(channel => channel && channel !== 'N/A');
  }

  getActiveSalesOrderCount(): number {
    // Count orders that are not cancelled or completed (based on document type)
    return this.filteredSalesOrders.filter(order => 
      order.auart !== 'CANC' && order.auart !== 'COMP').length;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.salesDocument) count++;
    if (this.filters.documentType) count++;
    if (this.filters.salesOrganization) count++;
    if (this.filters.distributionChannel) count++;
    if (this.filters.materialDescription) count++;
    if (this.filters.salesUnit) count++;
    return count;
  }
}
