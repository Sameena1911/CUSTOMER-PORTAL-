const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');

const router = express.Router();

// SAP service configuration for financial data
const SAP_CONFIG = {
  baseURL: 'http://AZKTLDS5CP.kcloud.com:8000',
  servicePath: '/sap/bc/srt/scs/sap/zcust_financial_service?sap-client=100',
  username: 'K901705',
  password: 'Sameena@1911',
  timeout: 30000
};

// Helper function to create SOAP envelope for financial data
function createFinancialSOAPEnvelope(customerId) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:sap-com:document:sap:rfc:functions">
  <soapenv:Header/>
  <soapenv:Body>
    <urn:ZCUST_FINANCIAL_FM>
      <I_KUNNR>${customerId}</I_KUNNR>
    </urn:ZCUST_FINANCIAL_FM>
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Helper function to parse financial SOAP response
async function parseFinancialSOAPResponse(xmlResponse) {
  try {
    const parser = new xml2js.Parser({ 
      explicitArray: false, 
      ignoreAttrs: true,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    
    const result = await parser.parseStringPromise(xmlResponse);
    
    // Navigate to the financial data in the SOAP response
    const financialResponse = result?.Envelope?.Body?.ZCUST_FINANCIAL_FMResponse;
    
    if (!financialResponse) {
      console.log('No financial response found in SOAP response');
      return {
        invoices: [],
        payments: [],
        creditDebitMemos: [],
        salesData: {}
      };
    }

    // Parse different financial data sections
    const financialData = {
      invoices: parseInvoiceData(financialResponse.E_INVOICE_LIST),
      payments: parsePaymentData(financialResponse.E_PAYMENT_LIST),
      creditDebitMemos: parseMemoData(financialResponse.E_MEMO_LIST),
      salesData: parseSalesData(financialResponse.E_SALES_SUMMARY)
    };

    return financialData;

  } catch (error) {
    console.error('Error parsing financial SOAP response:', error);
    throw new Error('Failed to parse financial response');
  }
}

// Helper function to parse invoice data
function parseInvoiceData(invoiceList) {
  if (!invoiceList) return [];
  
  let invoices = [];
  if (Array.isArray(invoiceList.item)) {
    invoices = invoiceList.item;
  } else if (invoiceList.item) {
    invoices = [invoiceList.item];
  }

  return invoices.map(invoice => ({
    invoiceNumber: invoice.VBELN || 'N/A',           // Invoice Number
    invoiceDate: invoice.FKDAT || 'N/A',             // Invoice Date
    dueDate: invoice.ZFBDT || 'N/A',                 // Due Date
    amount: parseFloat(invoice.NETWR) || 0,          // Net Amount
    currency: invoice.WAERK || 'USD',                // Currency
    status: invoice.STATUS || 'Open',                // Payment Status
    customerPO: invoice.BSTKD || 'N/A',              // Customer PO
    salesDocument: invoice.VGBEL || 'N/A',           // Sales Document
    paymentTerms: invoice.ZTERM || 'N/A',            // Payment Terms
    taxAmount: parseFloat(invoice.MWSBP) || 0        // Tax Amount
  }));
}

// Helper function to parse payment data
function parsePaymentData(paymentList) {
  if (!paymentList) return [];
  
  let payments = [];
  if (Array.isArray(paymentList.item)) {
    payments = paymentList.item;
  } else if (paymentList.item) {
    payments = [paymentList.item];
  }

  return payments.map(payment => ({
    paymentDocument: payment.BELNR || 'N/A',         // Payment Document
    paymentDate: payment.BUDAT || 'N/A',             // Payment Date
    amount: parseFloat(payment.DMBTR) || 0,          // Amount
    currency: payment.WAERS || 'USD',                // Currency
    paymentMethod: payment.ZLSCH || 'N/A',           // Payment Method
    reference: payment.XBLNR || 'N/A',               // Reference
    clearingDocument: payment.AUGBL || 'N/A',        // Clearing Document
    aging: parseInt(payment.AGING) || 0,             // Aging Days
    invoiceReference: payment.ZUONR || 'N/A'         // Invoice Reference
  }));
}

// Helper function to parse credit/debit memo data
function parseMemoData(memoList) {
  if (!memoList) return [];
  
  let memos = [];
  if (Array.isArray(memoList.item)) {
    memos = memoList.item;
  } else if (memoList.item) {
    memos = [memoList.item];
  }

  return memos.map(memo => ({
    documentNumber: memo.BELNR || 'N/A',             // Document Number
    documentDate: memo.BLDAT || 'N/A',               // Document Date
    type: memo.BLART || 'N/A',                       // Document Type (Credit/Debit)
    amount: parseFloat(memo.DMBTR) || 0,             // Amount
    currency: memo.WAERS || 'USD',                   // Currency
    reference: memo.XBLNR || 'N/A',                  // Reference
    reason: memo.SGTXT || 'N/A',                     // Reason/Text
    status: memo.STATUS || 'Posted',                 // Status
    originalInvoice: memo.REBZG || 'N/A'             // Original Invoice
  }));
}

// Helper function to parse sales data summary
function parseSalesData(salesSummary) {
  if (!salesSummary) return {};
  
  return {
    totalSales: parseFloat(salesSummary.TOTAL_SALES) || 0,
    totalInvoices: parseInt(salesSummary.TOTAL_INVOICES) || 0,
    totalPayments: parseFloat(salesSummary.TOTAL_PAYMENTS) || 0,
    outstandingAmount: parseFloat(salesSummary.OUTSTANDING_AMOUNT) || 0,
    creditLimit: parseFloat(salesSummary.CREDIT_LIMIT) || 0,
    creditUsed: parseFloat(salesSummary.CREDIT_USED) || 0,
    averagePaymentDays: parseInt(salesSummary.AVG_PAYMENT_DAYS) || 0,
    currency: salesSummary.CURRENCY || 'USD',
    lastPaymentDate: salesSummary.LAST_PAYMENT_DATE || 'N/A',
    overdueAmount: parseFloat(salesSummary.OVERDUE_AMOUNT) || 0
  };
}

// GET endpoint - Retrieve financial data for a customer
router.get('/financial/:customerId', async (req, res) => {
  try {
    const customerId = req.params.customerId;
    
    console.log(`Fetching financial data for customer: ${customerId}`);

    // Create SOAP envelope
    const soapEnvelope = createFinancialSOAPEnvelope(customerId);
    
    // Configure request
    const config = {
      method: 'post',
      url: SAP_CONFIG.baseURL + SAP_CONFIG.servicePath,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZCUST_FINANCIAL_FM'
      },
      data: soapEnvelope,
      auth: {
        username: SAP_CONFIG.username,
        password: SAP_CONFIG.password
      },
      timeout: SAP_CONFIG.timeout
    };

    console.log('Sending financial request to SAP...');

    // Make request to SAP
    const response = await axios(config);
    
    console.log('Received financial response from SAP, status:', response.status);

    // Parse the response
    const financialData = await parseFinancialSOAPResponse(response.data);
    
    console.log(`Parsed financial data with ${financialData.invoices.length} invoices, ${financialData.payments.length} payments`);

    // Return success response
    res.json({
      success: true,
      customerId: customerId,
      financialData: financialData,
      summary: {
        totalInvoices: financialData.invoices.length,
        totalPayments: financialData.payments.length,
        totalMemos: financialData.creditDebitMemos.length
      },
      message: 'Financial data retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching financial data:', error);
    
    // For development, return mock data if SAP is not available
    const mockFinancialData = {
      invoices: [
        {
          invoiceNumber: 'INV-2024-001',
          invoiceDate: '2024-01-15',
          dueDate: '2024-02-14',
          amount: 15000.00,
          currency: 'USD',
          status: 'Paid',
          customerPO: 'PO-12345',
          salesDocument: 'SO-2024-001',
          paymentTerms: 'Net 30',
          taxAmount: 1500.00
        },
        {
          invoiceNumber: 'INV-2024-002',
          invoiceDate: '2024-02-10',
          dueDate: '2024-03-12',
          amount: 8500.00,
          currency: 'USD',
          status: 'Overdue',
          customerPO: 'PO-12346',
          salesDocument: 'SO-2024-002',
          paymentTerms: 'Net 30',
          taxAmount: 850.00
        },
        {
          invoiceNumber: 'INV-2024-003',
          invoiceDate: '2024-03-05',
          dueDate: '2024-04-04',
          amount: 12000.00,
          currency: 'USD',
          status: 'Open',
          customerPO: 'PO-12347',
          salesDocument: 'SO-2024-003',
          paymentTerms: 'Net 30',
          taxAmount: 1200.00
        }
      ],
      payments: [
        {
          paymentDocument: 'PAY-2024-001',
          paymentDate: '2024-02-10',
          amount: 15000.00,
          currency: 'USD',
          paymentMethod: 'Bank Transfer',
          reference: 'TXN-123456789',
          clearingDocument: 'CLR-001',
          aging: 26,
          invoiceReference: 'INV-2024-001'
        },
        {
          paymentDocument: 'PAY-2024-002',
          paymentDate: '2024-03-15',
          amount: 5000.00,
          currency: 'USD',
          paymentMethod: 'Check',
          reference: 'CHK-987654321',
          clearingDocument: 'CLR-002',
          aging: 35,
          invoiceReference: 'INV-2024-002'
        }
      ],
      creditDebitMemos: [
        {
          documentNumber: 'CM-2024-001',
          documentDate: '2024-02-20',
          type: 'Credit Memo',
          amount: 500.00,
          currency: 'USD',
          reference: 'RETURN-001',
          reason: 'Product return - quality issue',
          status: 'Posted',
          originalInvoice: 'INV-2024-001'
        },
        {
          documentNumber: 'DM-2024-001',
          documentDate: '2024-03-01',
          type: 'Debit Memo',
          amount: 250.00,
          currency: 'USD',
          reference: 'FREIGHT-001',
          reason: 'Additional freight charges',
          status: 'Posted',
          originalInvoice: 'INV-2024-002'
        }
      ],
      salesData: {
        totalSales: 125000.00,
        totalInvoices: 8,
        totalPayments: 95000.00,
        outstandingAmount: 30000.00,
        creditLimit: 50000.00,
        creditUsed: 30000.00,
        averagePaymentDays: 28,
        currency: 'USD',
        lastPaymentDate: '2024-03-15',
        overdueAmount: 8500.00
      }
    };

    // Return mock data for development
    res.json({
      success: true,
      customerId: req.params.customerId,
      financialData: mockFinancialData,
      summary: {
        totalInvoices: mockFinancialData.invoices.length,
        totalPayments: mockFinancialData.payments.length,
        totalMemos: mockFinancialData.creditDebitMemos.length
      },
      message: 'Financial data retrieved successfully (mock data for development)',
      note: 'Using mock data - SAP service not available'
    });
  }
});

// POST endpoint - Alternative way to get financial data with request body
router.post('/financial', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID is required'
      });
    }

    // Redirect to GET endpoint logic
    req.params.customerId = customerId;
    return router.get('/financial/:customerId')(req, res);

  } catch (error) {
    console.error('Error in financial POST endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch financial data',
      details: error.message
    });
  }
});

// Test endpoint to verify service is working
router.get('/financial-test', (req, res) => {
  res.json({
    success: true,
    message: 'Financial service is working',
    service: 'zcust_financial_service',
    functionModule: 'ZCUST_FINANCIAL_FM',
    endpoints: {
      getFinancial: 'GET /api/customer/financial/:customerId',
      postFinancial: 'POST /api/customer/financial'
    }
  });
});

module.exports = router;
