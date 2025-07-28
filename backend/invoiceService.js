const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// Get invoice list for a customer
router.get('/invoices/:customerId', async (req, res) => {
  const { customerId } = req.params;
  
  if (!customerId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID is required' 
    });
  }

  try {
    console.log(`Fetching invoice list for customer: ${customerId}`);
    
    // Get payment aging data and extract invoice information
    const paymentAgingResponse = await axios.get(`http://localhost:3000/api/customer/payment-aging/${customerId}`);
    
    if (paymentAgingResponse.data.success && paymentAgingResponse.data.data) {
      const invoices = parseInvoiceDataFromPayage(paymentAgingResponse.data.data, customerId);
      
      res.json({
        success: true,
        message: 'Invoice list retrieved from SAP successfully',
        data: invoices
      });
    } else {
      console.log('No payment aging data found for customer:', customerId);
      res.json({
        success: true,
        message: 'No invoices found for customer',
        data: []
      });
    }
  } catch (error) {
    console.error('Error fetching invoice list:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice list',
      error: error.message
    });
  }
});

// Get invoice PDF for a specific document
router.get('/invoice-pdf/:customerId/:documentNumber', async (req, res) => {
  const { customerId, documentNumber } = req.params;

  if (!customerId || !documentNumber) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID and document number are required' 
    });
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:urn="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <urn:ZCUST_INVOICE_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
        <IV_VBELN>${documentNumber}</IV_VBELN>
      </urn:ZCUST_INVOICE_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Fetching invoice PDF for customer: ${customerId}, document: ${documentNumber}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_invoice_service?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': ''
        },
        auth: {
          username: 'K901705',
          password: 'Sameena@1911'
        },
        timeout: 30000
      }
    );

    console.log('SAP Invoice response received');
    console.log('Response size:', response.data.length);

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }

      try {
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (
          body[0]['n0:ZCUST_INVOICE_FMResponse'] || 
          body[0]['ns0:ZCUST_INVOICE_FMResponse'] ||
          body[0]['urn:ZCUST_INVOICE_FMResponse']
        );

        if (sapResponse && sapResponse[0] && sapResponse[0]['EV_PDF']) {
          const pdfBase64 = sapResponse[0]['EV_PDF'][0];
          
          console.log('PDF Base64 length:', pdfBase64 ? pdfBase64.length : 0);
          
          // Check if PDF data is actually present
          if (pdfBase64 && pdfBase64.trim() !== '') {
            res.json({
              success: true,
              message: 'Invoice PDF retrieved successfully',
              data: {
                pdfBase64: pdfBase64,
                documentNumber: documentNumber,
                customerId: customerId,
                fileName: `Invoice_${documentNumber}_${customerId}.pdf`
              }
            });
          } else {
            console.log('SAP returned empty PDF data for document:', documentNumber);
            // For now, we'll create a simple PDF with document info since SAP PDF is not available
            const fallbackPDF = generateFallbackPDF(documentNumber, customerId);
            
            res.json({
              success: true,
              message: 'Invoice PDF generated (SAP PDF not available)',
              data: {
                pdfBase64: fallbackPDF,
                documentNumber: documentNumber,
                customerId: customerId,
                fileName: `Invoice_${documentNumber}_${customerId}.pdf`
              }
            });
          }
        } else {
          console.log('SAP response format unexpected for invoice PDF');
          res.status(404).json({
            success: false,
            message: 'Invoice PDF not found in SAP response'
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP invoice response:', parseError);
        res.status(500).json({
          success: false,
          message: 'Error processing invoice PDF from SAP',
          error: parseError.message
        });
      }
    });

  } catch (error) {
    console.error('SAP invoice request failed:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice PDF from SAP',
      error: error.message
    });
  }
});

// Function to parse invoice data from payment aging response
function parseInvoiceDataFromPayage(payageData, customerId) {
  const invoiceList = [];
  
  console.log('Parsing invoice data from payage response:', JSON.stringify(payageData, null, 2));

  // Handle different data structure - the data might be an array directly
  let items = [];
  
  if (Array.isArray(payageData)) {
    items = payageData;
  } else if (payageData && payageData['item']) {
    items = Array.isArray(payageData['item']) ? payageData['item'] : [payageData['item']];
  } else if (payageData && typeof payageData === 'object') {
    // If payageData is an object with invoice properties directly
    items = [payageData];
  }
  
  console.log('Processing items:', items.length);
    
  items.forEach((item, index) => {
    console.log(`Processing item ${index}:`, item);
    
    // Handle different property access patterns
    const documentNumber = item.vbeln || item['VBELN'] || (item['VBELN'] && item['VBELN'][0]) || 'N/A';
    const billingDate = item.fkdat || item['FKDAT'] || (item['FKDAT'] && item['FKDAT'][0]) || 'N/A';
    const amount = item.netwr || item['NETWR'] || (item['NETWR'] && parseFloat(item['NETWR'][0])) || 0;
    const currency = item.waerk || item['WAERK'] || (item['WAERK'] && item['WAERK'][0]) || 'SAR';
    const agingDays = item.ageing_days || item['AGEING_DAYS'] || (item['AGEING_DAYS'] && parseInt(item['AGEING_DAYS'][0])) || 0;
      
    // Calculate due date (30 days from billing date)
    let dueDate = 'N/A';
    let formattedBillingDate = billingDate;
    
    // Format SAP date if needed
    if (billingDate !== 'N/A') {
      formattedBillingDate = formatSAPDate(billingDate);
      if (formattedBillingDate !== 'N/A') {
        const billing = new Date(formattedBillingDate);
        billing.setDate(billing.getDate() + 30);
        dueDate = billing.toISOString().split('T')[0];
      }
    }
    
    // Determine status based on aging days
    let status = 'Paid';
    if (agingDays > 0) {
      status = agingDays > 30 ? 'Overdue' : 'Pending';
    }
    
    console.log(`Invoice details - Document: ${documentNumber}, Amount: ${amount}, Date: ${formattedBillingDate}`);
    
    if (documentNumber !== 'N/A' && amount > 0) {
      invoiceList.push({
        invoiceNumber: documentNumber,
        invoiceDate: formattedBillingDate,
        dueDate: dueDate,
        amount: parseFloat(amount),
        currency: currency,
        status: status,
        description: `Invoice ${documentNumber}`,
        documentName: `Invoice_${documentNumber}.pdf`,
        agingDays: agingDays
      });
    }
  });

  console.log('Final invoice list:', invoiceList);
  return invoiceList;
}

// Helper function to format SAP date
function formatSAPDate(sapDate) {
  if (!sapDate) return 'N/A';
  
  // Handle different date formats
  const dateStr = sapDate.toString().trim();
  
  // If it's already in invalid format like "2025--0-5-", try to parse it
  if (dateStr.includes('--') || dateStr.includes('-0-')) {
    // Extract valid parts and create a proper date
    const parts = dateStr.split('-').filter(part => part && part !== '0');
    if (parts.length >= 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // If we can't parse it properly, return a default date
    return '2025-05-15'; // Default date for invalid SAP dates
  }
  
  // SAP date format is typically YYYYMMDD
  if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // If it's already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Fallback for any other format
  return '2025-05-15';
}

// Generate a simple fallback PDF when SAP PDF is not available
function generateFallbackPDF(documentNumber, customerId) {
  // Create a simple text-based PDF content
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

5 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
72 720 Td
(Invoice Document) Tj
0 -20 Td
(Document Number: ${documentNumber}) Tj
0 -20 Td
(Customer ID: ${customerId}) Tj
0 -20 Td
(Note: PDF content not available from SAP) Tj
0 -20 Td
(Please contact support for the actual invoice.) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000105 00000 n 
0000000251 00000 n 
0000000318 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
580
%%EOF`;

  // Convert to base64
  return Buffer.from(pdfContent, 'utf8').toString('base64');
}

module.exports = router;
