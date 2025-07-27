const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// GET /api/customer/overall-sales/:customerId
router.get('/overall-sales/:customerId', async (req, res) => {
  const customerId = req.params.customerId;

  if (!customerId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID is required' 
    });
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:urn="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <urn:ZOVERALL_SALESDATA_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
      </urn:ZOVERALL_SALESDATA_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Fetching overall sales data for customer: ${customerId}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zoverall_salesdata_service?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZOVERALL_SALESDATA_FM',
          'Authorization': 'Basic ' + Buffer.from('K901705:Sameena@1911').toString('base64')
        },
        timeout: 30000
      }
    );

    console.log('SAP response received for overall sales data');

    // Parse XML response
    parseString(response.data, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('Error parsing XML:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing response from SAP' 
        });
      }

      try {
        console.log('Parsed XML result:', JSON.stringify(result, null, 2));

        // Extract overall sales data from SAP response
        const salesData = parseOverallSalesData(result);
        
        res.json({
          success: true,
          message: 'Overall sales data retrieved successfully',
          data: salesData,
          sapResponse: result
        });

      } catch (parseError) {
        console.error('Error processing overall sales data:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing overall sales data from SAP',
          error: parseError.message 
        });
      }
    });

  } catch (error) {
    console.error('Error fetching overall sales data from SAP:', error.message);
    
    // Return mock data for development
    const mockSalesData = {
      totalSales: 125000.00,
      totalInvoices: 45,
      totalCreditMemos: 8,
      totalDebitMemos: 3,
      currency: 'EUR',
      totalNetValue: 118750.00,
      avgInvoiceValue: 2777.78,
      salesByType: {
        invoices: { count: 45, value: 125000.00 },
        creditMemos: { count: 8, value: -5250.00 },
        debitMemos: { count: 3, value: 1000.00 }
      },
      monthlyBreakdown: [
        { month: 'January 2024', invoices: 12, creditMemos: 2, debitMemos: 1, totalValue: 35000.00 },
        { month: 'February 2024', invoices: 10, creditMemos: 1, debitMemos: 0, totalValue: 28000.00 },
        { month: 'March 2024', invoices: 15, creditMemos: 3, debitMemos: 1, totalValue: 42000.00 },
        { month: 'April 2024', invoices: 8, creditMemos: 2, debitMemos: 1, totalValue: 18750.00 }
      ],
      recentTransactions: [
        {
          vbeln: '6090000001',
          fkdat: '2024-04-15',
          fkart: 'F2',
          netwr: 3500.00,
          waerk: 'EUR',
          kunag: customerId,
          augdt: '2024-04-20',
          augbl: 'PAY001',
          description: 'Standard Invoice'
        },
        {
          vbeln: '6090000002', 
          fkdat: '2024-04-10',
          fkart: 'G2',
          netwr: -250.00,
          waerk: 'EUR',
          kunag: customerId,
          augdt: '2024-04-12',
          augbl: 'CR001',
          description: 'Credit Memo'
        },
        {
          vbeln: '6090000003',
          fkdat: '2024-04-08',
          fkart: 'L2',
          netwr: 150.00,
          waerk: 'EUR',
          kunag: customerId,
          augdt: '',
          augbl: '',
          description: 'Debit Memo'
        }
      ]
    };

    res.json({
      success: true,
      message: 'Overall sales data retrieved successfully (mock data)',
      data: mockSalesData,
      isMockData: true
    });
  }
});

function parseOverallSalesData(sapResponse) {
  const salesData = {
    totalSales: 0,
    totalInvoices: 0,
    totalCreditMemos: 0,
    totalDebitMemos: 0,
    currency: 'EUR',
    totalNetValue: 0,
    avgInvoiceValue: 0,
    salesByType: {
      invoices: { count: 0, value: 0 },
      creditMemos: { count: 0, value: 0 },
      debitMemos: { count: 0, value: 0 }
    },
    monthlyBreakdown: [],
    recentTransactions: []
  };

  try {
    // Navigate through the SOAP response structure
    const envelope = sapResponse['soap-env:Envelope'] || sapResponse.Envelope;
    const body = envelope['soap-env:Body'] || envelope.Body;
    const salesResponse = body['n0:ZOVERALL_SALESDATA_FMResponse'] || body.ZOVERALL_SALESDATA_FMResponse;

    if (salesResponse && salesResponse.ET_SALESDATA) {
      const salesItems = salesResponse.ET_SALESDATA.item || salesResponse.ET_SALESDATA;
      const itemArray = Array.isArray(salesItems) ? salesItems : [salesItems];
      
      itemArray.forEach(item => {
        const fkart = item.FKART || item.fkart || '';
        const netwr = parseFloat(item.NETWR || item.netwr || 0);
        
        // Add to recent transactions
        salesData.recentTransactions.push({
          vbeln: item.VBELN || item.vbeln || '',
          fkdat: item.FKDAT || item.fkdat || '',
          fkart: fkart,
          netwr: netwr,
          waerk: item.WAERK || item.waerk || 'EUR',
          kunag: item.KUNAG || item.kunag || '',
          augdt: item.AUGDT || item.augdt || '',
          augbl: item.AUGBL || item.augbl || '',
          description: getDocumentTypeDescription(fkart)
        });

        // Categorize by document type
        switch (fkart) {
          case 'F2': // Invoice
            salesData.salesByType.invoices.count++;
            salesData.salesByType.invoices.value += netwr;
            salesData.totalInvoices++;
            break;
          case 'G2': // Credit Memo
            salesData.salesByType.creditMemos.count++;
            salesData.salesByType.creditMemos.value += netwr;
            salesData.totalCreditMemos++;
            break;
          case 'L2': // Debit Memo
            salesData.salesByType.debitMemos.count++;
            salesData.salesByType.debitMemos.value += netwr;
            salesData.totalDebitMemos++;
            break;
        }
        
        salesData.totalNetValue += netwr;
      });

      // Calculate totals
      salesData.totalSales = salesData.salesByType.invoices.value;
      salesData.avgInvoiceValue = salesData.totalInvoices > 0 ? 
        salesData.salesByType.invoices.value / salesData.totalInvoices : 0;
    }

    console.log('Parsed overall sales data:', salesData);
    return salesData;

  } catch (error) {
    console.error('Error parsing overall sales data:', error);
    return salesData; // Return empty structure on error
  }
}

function getDocumentTypeDescription(fkart) {
  switch (fkart) {
    case 'F2': return 'Standard Invoice';
    case 'G2': return 'Credit Memo';
    case 'L2': return 'Debit Memo';
    default: return 'Unknown Document Type';
  }
}

module.exports = router;
