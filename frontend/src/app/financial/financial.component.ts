import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  status: string;
  description: string;
}

interface PaymentData {
  paymentId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  invoiceNumber: string;
  agingDays: number;
}

interface CreditDebitMemo {
  memoNumber: string;
  memoDate: string;
  type: string; // 'Credit' or 'Debit'
  amount: number;
  reason: string;
  status: string;
}

interface SalesData {
  period: string;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  topProduct: string;
}

@Component({
  selector: 'app-financial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './financial.component.html',
  styleUrls: ['./financial.component.css']
})
export class FinancialComponent implements OnInit {
  
  // Tab management
  activeTab: string = 'overview';
  
  // Loading states
  loading = false;
  error: string | null = null;
  
  // Customer ID
  customerId: string | null = null;
  
  // Financial data
  financialData: any = {
    invoices: [],
    payments: [],
    creditDebitMemos: [],
    salesData: {},
    paymentAging: [],
    creditMemos: [],
    debitMemos: []
  };

  // Overall sales data
  overallSalesData: any = null;

  // Overall sales pagination and filtering
  overallSalesFilters = {
    documentType: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    description: ''
  };
  
  filteredOverallSalesTransactions: any[] = [];
  paginatedOverallSalesTransactions: any[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 0;

  // Toggle state for memo view
  showCreditMemos: boolean = true;

  // Filter properties for different sections
  invoiceFilters = {
    status: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
  };

  // Payment filters removed - displaying all data directly

  memoFilters = {
    type: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: ''
  };

  // Filtered data arrays
  filteredInvoices: any[] = [];
  filteredPayments: any[] = [];
  filteredMemos: any[] = [];

  constructor(private router: Router, private http: HttpClient) {}

  // Track by function for ngFor performance
  trackByPayment(index: number, payment: any): any {
    return payment.vbeln || index;
  }

  ngOnInit() {
    this.customerId = localStorage.getItem('customerId');
    if (!this.customerId) {
      console.error('No customer ID found, redirecting to login');
      this.router.navigate(['/login']);
      return;
    }
    this.loadFinancialData();
    
    // Load overall sales data by default since overview tab is active by default
    if (this.activeTab === 'overview') {
      this.loadOverallSalesData();
    }
  }

  loadFinancialData() {
    if (!this.customerId) return;

    this.loading = true;
    this.error = null;

    console.log('Loading financial data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/financial/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('Financial data response:', response);
          this.loading = false;
          
          if (response.success && response.data) {
            // Merge new data with existing data to preserve paymentAging if already loaded
            this.financialData = {
              ...this.financialData,
              ...response.data
            };
            this.applyAllFilters();
            console.log('Loaded financial data successfully');
          } else {
            this.error = response.error || 'No financial data available';
          }
        },
        error: (error) => {
          console.error('Error loading financial data:', error);
          this.loading = false;
          this.error = error.error?.error || 'Failed to load financial data';
        }
      });
  }

  refreshData() {
    this.loadFinancialData();
  }

  loadPaymentAgingData() {
    if (!this.customerId) return;

    this.loading = true;
    this.error = null;

    console.log('Loading payment aging data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/payment-aging/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('=== Payment aging API response ===');
          console.log('Full response:', response);
          console.log('Response success:', response.success);
          console.log('Response data:', response.data);
          console.log('Response data length:', response.data ? response.data.length : 'undefined');
          this.loading = false;
          
          if (response.success && response.data) {
            this.financialData.paymentAging = response.data;
            console.log('✅ Loaded payment aging data successfully. Total entries:', response.data.length);
            console.log('✅ Raw payment aging data:', response.data);
            console.log('✅ financialData.paymentAging after assignment:', this.financialData.paymentAging);
            
            // Apply filters after loading data to ensure all entries are displayed
            this.applyPaymentFilters();
          } else {
            this.error = response.message || 'No payment aging data available';
            console.error('❌ Payment aging error:', this.error);
          }
        },
        error: (error) => {
          console.error('Error loading payment aging data:', error);
          this.loading = false;
          this.error = error.error?.message || 'Failed to load payment aging data';
        }
      });
  }

  loadMemoData() {
    if (!this.customerId) return;
    
    this.loading = true;
    this.error = null;

    console.log('Loading memo data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/memos/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('Memo data response:', response);
          this.loading = false;
          
          if (response.success && response.data) {
            this.financialData.creditMemos = response.data.creditMemos || [];
            this.financialData.debitMemos = response.data.debitMemos || [];
            console.log('Loaded memo data successfully');
          } else {
            this.error = response.message || 'No memo data available';
          }
        },
        error: (error) => {
          console.error('Error loading memo data:', error);
          this.loading = false;
          this.error = error.error?.message || 'Failed to load memo data';
        }
      });
  }

  loadOverallSalesData() {
    if (!this.customerId) return;
    
    this.loading = true;
    this.error = null;

    console.log('Loading overall sales data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/overall-sales/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('Overall sales data response:', response);
          this.loading = false;
          
          if (response.success && response.data) {
            this.overallSalesData = response.data;
            this.applyOverallSalesFilters();
            console.log('Loaded overall sales data successfully');
          } else {
            this.error = response.message || 'No overall sales data available';
          }
        },
        error: (error) => {
          console.error('Error loading overall sales data:', error);
          this.loading = false;
          this.error = error.error?.message || 'Failed to load overall sales data';
        }
      });
  }

  loadInvoiceData() {
    if (!this.customerId) return;
    
    this.loading = true;
    this.error = null;

    console.log('Loading invoice data for customer:', this.customerId);

    this.http.get<any>(`http://localhost:3000/api/customer/invoices/${this.customerId}`)
      .subscribe({
        next: (response) => {
          console.log('Invoice data response:', response);
          this.loading = false;
          
          if (response.success && response.data) {
            this.financialData.invoices = response.data;
            this.applyInvoiceFilters();
            console.log('Loaded invoice data successfully');
          } else {
            this.error = response.message || 'No invoice data available';
          }
        },
        error: (error) => {
          console.error('Error loading invoice data:', error);
          this.loading = false;
          this.error = error.error?.message || 'Failed to load invoice data';
        }
      });
  }

  viewInvoice(invoiceNumber: string) {
    if (!this.customerId || !invoiceNumber) return;

    console.log('Viewing invoice:', invoiceNumber);
    
    this.http.get<any>(`http://localhost:3000/api/customer/invoice-pdf/${this.customerId}/${invoiceNumber}`)
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.pdfBase64) {
            // Convert base64 to blob and open in new window
            const byteCharacters = atob(response.data.pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            
            // Show message if this is a fallback PDF
            if (response.message && response.message.includes('SAP PDF not available')) {
              alert('Note: This is a placeholder PDF as the original invoice PDF is not available from SAP. Please contact support for the actual invoice document.');
            }
            
            // Clean up the URL after a delay
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          } else {
            console.error('Invalid PDF response:', response);
            alert('Unable to view invoice. PDF data not available.');
          }
        },
        error: (error) => {
          console.error('Error viewing invoice:', error);
          alert('Failed to load invoice PDF. Please try again.');
        }
      });
  }

  downloadInvoice(invoiceNumber: string) {
    if (!this.customerId || !invoiceNumber) return;

    console.log('Downloading invoice:', invoiceNumber);
    
    this.http.get<any>(`http://localhost:3000/api/customer/invoice-pdf/${this.customerId}/${invoiceNumber}`)
      .subscribe({
        next: (response) => {
          if (response.success && response.data && response.data.pdfBase64) {
            // Convert base64 to blob and trigger download
            const byteCharacters = atob(response.data.pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = response.data.fileName || `Invoice_${invoiceNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show message if this is a fallback PDF
            if (response.message && response.message.includes('SAP PDF not available')) {
              alert('Note: Downloaded placeholder PDF as the original invoice PDF is not available from SAP. Please contact support for the actual invoice document.');
            }
            
            // Clean up the URL
            window.URL.revokeObjectURL(url);
          } else {
            console.error('Invalid PDF response:', response);
            alert('Unable to download invoice. PDF data not available.');
          }
        },
        error: (error) => {
          console.error('Error downloading invoice:', error);
          alert('Failed to download invoice PDF. Please try again.');
        }
      });
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  // Tab management
  setActiveTab(tab: string) {
    this.activeTab = tab;
    
    // Load overall sales data when overview tab is selected
    if (tab === 'overview' && !this.overallSalesData) {
      this.loadOverallSalesData();
    }
    
    // Load invoice data when invoices tab is selected
    if (tab === 'invoices' && (!this.financialData.invoices || this.financialData.invoices.length === 0)) {
      this.loadInvoiceData();
    }
    
    // Load payment aging data when payments tab is selected (always load to ensure fresh data)
    if (tab === 'payments') {
      this.loadPaymentAgingData();
    }
    
    // Load memo data when memos tab is selected
    if (tab === 'memos' && this.financialData && 
        (!this.financialData.creditMemos || this.financialData.creditMemos.length === 0) &&
        (!this.financialData.debitMemos || this.financialData.debitMemos.length === 0)) {
      this.loadMemoData();
    }
  }

  // Filter methods
  applyAllFilters() {
    this.applyInvoiceFilters();
    this.applyPaymentFilters();
    this.applyMemoFilters();
  }

  applyInvoiceFilters() {
    this.filteredInvoices = this.financialData.invoices.filter((invoice: any) => {
      // Status filter
      if (this.invoiceFilters.status && invoice.status !== this.invoiceFilters.status) {
        return false;
      }

      // Date range filter
      if (this.invoiceFilters.dateFrom || this.invoiceFilters.dateTo) {
        const invoiceDate = new Date(invoice.invoiceDate);
        if (this.invoiceFilters.dateFrom && invoiceDate < new Date(this.invoiceFilters.dateFrom)) {
          return false;
        }
        if (this.invoiceFilters.dateTo && invoiceDate > new Date(this.invoiceFilters.dateTo)) {
          return false;
        }
      }

      // Amount range filter
      if (this.invoiceFilters.amountMin && invoice.amount < parseFloat(this.invoiceFilters.amountMin)) {
        return false;
      }
      if (this.invoiceFilters.amountMax && invoice.amount > parseFloat(this.invoiceFilters.amountMax)) {
        return false;
      }

      return true;
    });
  }

  // Simplified to show all payment aging data without filtering
  applyPaymentFilters() {
    console.log('=== applyPaymentFilters called ===');
    console.log('financialData object:', this.financialData);
    console.log('paymentAging array:', this.financialData.paymentAging);
    console.log('paymentAging length:', this.financialData.paymentAging ? this.financialData.paymentAging.length : 'undefined');
    
    // Ensure payment aging data is loaded first
    if (!this.financialData.paymentAging || this.financialData.paymentAging.length === 0) {
      console.log('Payment aging data not available, loading...');
      this.loadPaymentAgingData();
      return;
    }

    // Display all payment aging data without any filtering
    this.filteredPayments = [...this.financialData.paymentAging];

    console.log('Applied payment filters - Total payment aging entries:', this.filteredPayments.length);
    console.log('Payment aging data:', this.filteredPayments);
    console.log('Sample entries for debugging:');
    this.filteredPayments.slice(0, 5).forEach((payment, index) => {
      console.log(`Entry ${index + 1}:`, {
        kunnr: payment.kunnr,
        vbeln: payment.vbeln,
        netwr: payment.netwr,
        fkdat: payment.fkdat
      });
    });
    
    // Force Angular change detection
    setTimeout(() => {
      console.log('After timeout - filteredPayments still has:', this.filteredPayments.length, 'entries');
    }, 100);
    
    console.log('=== applyPaymentFilters completed ===');
  }

  applyMemoFilters() {
    // Get the appropriate memo array based on toggle state
    const memoArray = this.showCreditMemos ? 
      (this.financialData.creditMemos || []) : 
      (this.financialData.debitMemos || []);

    this.filteredMemos = memoArray.filter((memo: any) => {
      // Date range filter
      if (this.memoFilters.dateFrom || this.memoFilters.dateTo) {
        const memoDate = new Date(memo.fkdat);
        if (this.memoFilters.dateFrom && memoDate < new Date(this.memoFilters.dateFrom)) {
          return false;
        }
        if (this.memoFilters.dateTo && memoDate > new Date(this.memoFilters.dateTo)) {
          return false;
        }
      }

      // Amount range filter
      if (this.memoFilters.amountMin && Math.abs(memo.netwr) < parseFloat(this.memoFilters.amountMin)) {
        return false;
      }
      if (this.memoFilters.amountMax && Math.abs(memo.netwr) > parseFloat(this.memoFilters.amountMax)) {
        return false;
      }

      return true;
    });
  }

  clearInvoiceFilters() {
    this.invoiceFilters = {
      status: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: ''
    };
    this.applyInvoiceFilters();
  }

  // clearPaymentFilters method removed - no longer needed since filters are removed

  clearMemoFilters() {
    this.memoFilters = {
      type: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: ''
    };
    this.applyMemoFilters();
  }

  toggleMemoType(showCredit: boolean) {
    this.showCreditMemos = showCredit;
    this.applyMemoFilters();
  }

  // Helper methods - force recompilation
  getUniqueInvoiceStatuses(): string[] {
    const statuses = Array.from(new Set(this.financialData.invoices.map((invoice: any) => invoice.status)));
    return statuses.filter(status => typeof status === 'string' && status && status !== 'N/A') as string[];
  }

  getUniqueMemoTypes(): string[] {
    const types = Array.from(new Set(this.financialData.creditDebitMemos.map((memo: any) => memo.type)));
    return types.filter(type => typeof type === 'string' && type && type !== 'N/A') as string[];
  }

  // Calculation methods
  getTotalInvoiceAmount(): number {
    return this.filteredInvoices.reduce((total, invoice) => total + invoice.amount, 0);
  }

  getTotalPaymentAmount(): number {
    return this.filteredPayments.reduce((total, payment) => total + payment.amount, 0);
  }

  getTotalMemoAmount(): number {
    return this.filteredMemos.reduce((total, memo) => total + memo.amount, 0);
  }

  getOverdueInvoices(): any[] {
    const today = new Date();
    return this.filteredInvoices.filter(invoice => {
      const dueDate = new Date(invoice.dueDate);
      return dueDate < today && invoice.status !== 'Paid';
    });
  }

  getAgingAnalysis(): { range: string, count: number, amount: number }[] {
    const today = new Date();
    const aging = [
      { range: '0-30 days', count: 0, amount: 0 },
      { range: '31-60 days', count: 0, amount: 0 },
      { range: '61-90 days', count: 0, amount: 0 },
      { range: '90+ days', count: 0, amount: 0 }
    ];

    this.filteredInvoices.filter(invoice => invoice.status !== 'Paid').forEach(invoice => {
      const dueDate = new Date(invoice.dueDate);
      const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysPastDue <= 30) {
        aging[0].count++;
        aging[0].amount += invoice.amount;
      } else if (daysPastDue <= 60) {
        aging[1].count++;
        aging[1].amount += invoice.amount;
      } else if (daysPastDue <= 90) {
        aging[2].count++;
        aging[2].amount += invoice.amount;
      } else {
        aging[3].count++;
        aging[3].amount += invoice.amount;
      }
    });

    return aging;
  }

  getCreditUtilizationPercentage(): number {
    if (!this.financialData.salesData.creditLimit) return 0;
    return (this.financialData.salesData.creditUsed / this.financialData.salesData.creditLimit) * 100;
  }

  // Format helpers
  formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  formatDate(dateString: string): string {
    if (!dateString || dateString === 'N/A') return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'paid': return 'status-paid';
      case 'open': return 'status-open';
      case 'overdue': return 'status-overdue';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-default';
    }
  }

  getMemoTypeClass(type: string): string {
    return type.toLowerCase().includes('credit') ? 'memo-credit' : 'memo-debit';
  }

  // Payment Aging specific methods
  getTotalPaymentAgingAmount(): number {
    if (!this.financialData || !this.financialData.paymentAging) return 0;
    return this.financialData.paymentAging.reduce((total: number, item: any) => total + (item.amount || 0), 0);
  }

  getAgingCount(status: string): number {
    if (!this.financialData || !this.financialData.paymentAging) return 0;
    return this.financialData.paymentAging.filter((item: any) => item.status === status).length;
  }

  getAgingAmount(status: string): number {
    if (!this.financialData || !this.financialData.paymentAging) return 0;
    return this.financialData.paymentAging
      .filter((item: any) => item.status === status)
      .reduce((total: number, item: any) => total + (item.amount || 0), 0);
  }

  getRowClass(status: string): string {
    switch (status) {
      case 'Current': return 'row-current';
      case '1-30 Days': return 'row-overdue-30';
      case '31-60 Days': return 'row-overdue-60';
      case '61-90 Days': return 'row-overdue-90';
      case 'Over 90 Days': return 'row-overdue-90plus';
      default: return '';
    }
  }

  getAgingClass(agingDays: number): string {
    if (agingDays <= 0) return 'aging-current';
    if (agingDays <= 30) return 'aging-30';
    if (agingDays <= 60) return 'aging-60';
    if (agingDays <= 90) return 'aging-90';
    return 'aging-90plus';
  }

  // Memo-related methods
  toggleMemoView() {
    this.showCreditMemos = !this.showCreditMemos;
  }

  getTotalCreditAmount(): number {
    if (!this.financialData || !this.financialData.creditMemos) return 0;
    return this.financialData.creditMemos.reduce((total: number, memo: any) => total + Math.abs(memo.netwr || 0), 0);
  }

  getTotalDebitAmount(): number {
    if (!this.financialData || !this.financialData.debitMemos) return 0;
    return this.financialData.debitMemos.reduce((total: number, memo: any) => total + (memo.netwr || 0), 0);
  }

  getNetMemoAmount(): number {
    return this.getTotalDebitAmount() - this.getTotalCreditAmount();
  }

  // Overall Sales Data helper methods
  getTransactionRowClass(fkart: string): string {
    switch (fkart) {
      case 'F2': return 'transaction-invoice';
      case 'G2': return 'transaction-credit';
      case 'L2': return 'transaction-debit';
      default: return '';
    }
  }

  getDocumentTypeClass(fkart: string): string {
    switch (fkart) {
      case 'F2': return 'doc-type-invoice';
      case 'G2': return 'doc-type-credit';
      case 'L2': return 'doc-type-debit';
      default: return 'doc-type-default';
    }
  }

  getAmountClass(amount: number): string {
    if (amount > 0) return 'amount-positive';
    if (amount < 0) return 'amount-negative';
    return 'amount-zero';
  }

  // Overall Sales Data filtering and pagination methods
  applyOverallSalesFilters() {
    if (!this.overallSalesData || !this.overallSalesData.recentTransactions) {
      this.filteredOverallSalesTransactions = [];
      this.updatePagination();
      return;
    }

    this.filteredOverallSalesTransactions = this.overallSalesData.recentTransactions.filter((transaction: any) => {
      // Document type filter
      if (this.overallSalesFilters.documentType && transaction.fkart !== this.overallSalesFilters.documentType) {
        return false;
      }

      // Date range filter
      if (this.overallSalesFilters.dateFrom || this.overallSalesFilters.dateTo) {
        const transactionDate = new Date(transaction.fkdat);
        if (this.overallSalesFilters.dateFrom && transactionDate < new Date(this.overallSalesFilters.dateFrom)) {
          return false;
        }
        if (this.overallSalesFilters.dateTo && transactionDate > new Date(this.overallSalesFilters.dateTo)) {
          return false;
        }
      }

      // Amount range filter
      if (this.overallSalesFilters.amountMin && Math.abs(transaction.netwr) < parseFloat(this.overallSalesFilters.amountMin)) {
        return false;
      }
      if (this.overallSalesFilters.amountMax && Math.abs(transaction.netwr) > parseFloat(this.overallSalesFilters.amountMax)) {
        return false;
      }

      // Description filter
      if (this.overallSalesFilters.description && 
          transaction.description && 
          !transaction.description.toLowerCase().includes(this.overallSalesFilters.description.toLowerCase())) {
        return false;
      }

      return true;
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredOverallSalesTransactions.length / this.itemsPerPage);
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    
    this.paginatedOverallSalesTransactions = this.filteredOverallSalesTransactions.slice(startIndex, endIndex);
  }

  goToPage(page: number | string) {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  previousPage() {
    this.goToPage(this.currentPage - 1);
  }

  clearOverallSalesFilters() {
    this.overallSalesFilters = {
      documentType: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      description: ''
    };
    this.applyOverallSalesFilters();
  }

  getUniqueDocumentTypes(): string[] {
    if (!this.overallSalesData || !this.overallSalesData.recentTransactions) return [];
    const types = Array.from(new Set(this.overallSalesData.recentTransactions.map((transaction: any) => transaction.fkart)));
    return types.filter(type => typeof type === 'string' && type) as string[];
  }

  getDocumentTypeName(fkart: string): string {
    switch (fkart) {
      case 'F2': return 'Invoice';
      case 'G2': return 'Credit Memo';
      case 'L2': return 'Debit Memo';
      default: return fkart;
    }
  }

  getPaginationRange(): (number | string)[] {
    const range: (number | string)[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    
    // Add first page if not in range
    if (start > 1) {
      range.push(1);
      if (start > 2) {
        range.push('...');
      }
    }
    
    // Add main range
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    
    // Add last page if not in range
    if (end < this.totalPages) {
      if (end < this.totalPages - 1) {
        range.push('...');
      }
      range.push(this.totalPages);
    }
    
    return range;
  }

  // Helper method to calculate total amount for filtered transactions
  getFilteredTransactionsTotalAmount(): number {
    if (!this.filteredOverallSalesTransactions) return 0;
    return this.filteredOverallSalesTransactions.reduce((sum, transaction) => sum + (transaction.netwr || 0), 0);
  }

  // Helper method to calculate average transaction amount
  getAverageTransactionAmount(): number {
    if (!this.filteredOverallSalesTransactions || this.filteredOverallSalesTransactions.length === 0) return 0;
    const total = this.getFilteredTransactionsTotalAmount();
    return total / this.filteredOverallSalesTransactions.length;
  }

  // Helper method to check if page is a number
  isPageNumber(page: number | string): boolean {
    return typeof page === 'number';
  }
}
