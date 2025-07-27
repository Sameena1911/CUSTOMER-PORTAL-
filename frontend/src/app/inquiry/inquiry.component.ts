import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface InquiryData {
  vbeln: string;  // Sales Document
  ernam: string;  // Created By
  kunnr: string;  // Customer Number
  erdat: string;  // Created Date
  auart: string;  // Document Type
  netwr: number | string;  // Net Value
  knumv: string;  // Number of Document Condition
}

@Component({
  selector: 'app-inquiry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inquiry.component.html',
  styleUrl: './inquiry.component.css'
})
export class InquiryComponent implements OnInit {
  inquiries: InquiryData[] = [];
  filteredInquiries: InquiryData[] = [];
  loading = false;
  error: string | null = null;
  customerId: string | null = null;
  totalCount = 0;

  // Filter properties
  showFilters = false;
  filters = {
    salesDocument: '',
    documentType: '',
    createdBy: '',
    dateFrom: '',
    dateTo: '',
    minValue: '',
    maxValue: ''
  };

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.customerId = localStorage.getItem('customerId');
    if (this.customerId) {
      this.loadInquiryData();
    } else {
      this.error = 'Customer ID not found. Please login again.';
    }
  }

  loadInquiryData() {
    if (!this.customerId) return;

    this.loading = true;
    this.error = null;

    this.http.get<any>(`http://localhost:3000/api/customer/inquiries/${this.customerId}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.inquiries = response.inquiries || [];
            this.filteredInquiries = [...this.inquiries];
            this.totalCount = response.totalCount || 0;
            console.log('Inquiry data loaded successfully:', this.inquiries);
          } else {
            this.error = response.message || 'Failed to load inquiry data';
            this.inquiries = [];
            this.filteredInquiries = [];
          }
        },
        error: (error) => {
          this.loading = false;
          console.error('Error loading inquiry data:', error);
          this.error = error.error?.message || 'Failed to connect to server';
          this.inquiries = [];
          this.filteredInquiries = [];
        }
      });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  refreshData() {
    this.loadInquiryData();
  }

  formatCurrency(value: number | string): string {
    if (typeof value === 'string') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return value;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(numValue);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  getDocumentTypeDescription(auart: string): string {
    switch (auart) {
      case 'AF': return 'Inquiry';
      case 'AN': return 'Quotation';
      case 'OR': return 'Standard Order';
      case 'KA': return 'Contract';
      default: return auart;
    }
  }

  getTotalValue(): number {
    return this.inquiries.reduce((total, inquiry) => {
      const value = typeof inquiry.netwr === 'string' ? parseFloat(inquiry.netwr) : inquiry.netwr;
      return total + (isNaN(value) ? 0 : value);
    }, 0);
  }

  // Filter functions
  toggleFilters() {
    this.showFilters = !this.showFilters;
  }

  applyFilters() {
    this.filteredInquiries = this.inquiries.filter(inquiry => {
      // Sales Document filter
      if (this.filters.salesDocument && 
          !inquiry.vbeln.toLowerCase().includes(this.filters.salesDocument.toLowerCase())) {
        return false;
      }

      // Document Type filter
      if (this.filters.documentType && inquiry.auart !== this.filters.documentType) {
        return false;
      }

      // Created By filter
      if (this.filters.createdBy && 
          !inquiry.ernam.toLowerCase().includes(this.filters.createdBy.toLowerCase())) {
        return false;
      }

      // Date range filter
      if (this.filters.dateFrom || this.filters.dateTo) {
        const inquiryDate = this.parseDate(inquiry.erdat);
        
        if (this.filters.dateFrom) {
          const fromDate = new Date(this.filters.dateFrom);
          if (inquiryDate < fromDate) return false;
        }
        
        if (this.filters.dateTo) {
          const toDate = new Date(this.filters.dateTo);
          if (inquiryDate > toDate) return false;
        }
      }

      // Value range filter
      const netValue = typeof inquiry.netwr === 'string' ? parseFloat(inquiry.netwr) : inquiry.netwr;
      
      if (this.filters.minValue && netValue < parseFloat(this.filters.minValue)) {
        return false;
      }
      
      if (this.filters.maxValue && netValue > parseFloat(this.filters.maxValue)) {
        return false;
      }

      return true;
    });

    this.totalCount = this.filteredInquiries.length;
  }

  clearFilters() {
    this.filters = {
      salesDocument: '',
      documentType: '',
      createdBy: '',
      dateFrom: '',
      dateTo: '',
      minValue: '',
      maxValue: ''
    };
    this.filteredInquiries = [...this.inquiries];
    this.totalCount = this.inquiries.length;
  }

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

  getUniqueDocumentTypes(): string[] {
    const types = [...new Set(this.inquiries.map(inquiry => inquiry.auart))];
    return types.filter(type => type && type !== 'N/A');
  }

  getFilteredTotalValue(): number {
    return this.filteredInquiries.reduce((total, inquiry) => {
      const value = typeof inquiry.netwr === 'string' ? parseFloat(inquiry.netwr) : inquiry.netwr;
      return total + (isNaN(value) ? 0 : value);
    }, 0);
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.salesDocument) count++;
    if (this.filters.documentType) count++;
    if (this.filters.createdBy) count++;
    if (this.filters.dateFrom) count++;
    if (this.filters.dateTo) count++;
    if (this.filters.minValue) count++;
    if (this.filters.maxValue) count++;
    return count;
  }
}
