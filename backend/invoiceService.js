const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// GET /api/customer/invoices/:customerId
router.get('/invoices/:customerId', async (req, res) => {
  const customerId = req.params.customerId;

  if (!customerId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID is required' 
    });
  }

  // For invoice list, we'll use the payment aging data as it contains invoice numbers
  // and then enrich it with invoice-specific details
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:urn="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <urn:ZCUST_PORTAL_PAYAGE_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
      </urn:ZCUST_PORTAL_PAYAGE_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Fetching invoices from SAP for customer: ${customerId}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_payage_services?sap-client=100',
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

    console.log('SAP Invoice List response received');

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
          body[0]['n0:ZCUST_PORTAL_PAYAGE_FMResponse'] || 
          body[0]['ns0:ZCUST_PORTAL_PAYAGE_FMResponse'] ||
          body[0]['urn:ZCUST_PORTAL_PAYAGE_FMResponse']
        );

        if (sapResponse && sapResponse[0] && sapResponse[0]['EV_PAYAGE']) {
          const payageData = sapResponse[0]['EV_PAYAGE'][0];
          const invoices = parseInvoiceDataFromPayage(payageData, customerId);
          
          res.json({
            success: true,
            message: 'Invoice list retrieved from SAP successfully',
            data: invoices
          });
        } else {
          console.log('SAP response format unexpected for invoices, returning empty list');
          res.json({
            success: true,
            message: 'No invoices found in SAP response',
            data: []
          });
        }
      } catch (parseError) {
        console.error('Error parsing SAP response structure:', parseError);
        res.status(500).json({
          success: false,
          message: 'Error processing SAP response for invoices',
          error: parseError.message
        });
      }
    });

  } catch (error) {
    console.error('SAP invoice request failed:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices from SAP',
      error: error.message
    });
  }
});

// GET /api/customer/invoice-pdf/:customerId/:documentNumber
router.get('/invoice-pdf/:customerId/:documentNumber', async (req, res) => {
  const { customerId, documentNumber } = req.params;

  if (!customerId || !documentNumber) {
    return res.status(400).json({ 
      success: false, 
      message: 'Customer ID and Document Number are required' 
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
    console.log('Response size:', response.data.length, 'characters');

    parseString(response.data, (err, result) => {
      if (err) {
        console.error('SOAP Parsing Error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error parsing SAP response' 
        });
      }

      try {
        console.log('Parsing SAP response structure');
        
        const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
        const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
        const sapResponse = body && body[0] && (
          body[0]['n0:ZCUST_INVOICE_FMResponse'] || 
          body[0]['ns0:ZCUST_INVOICE_FMResponse'] ||
          body[0]['urn:ZCUST_INVOICE_FMResponse']
        );

        console.log('SAP Response Found:', !!sapResponse);

        // Check for error messages in SAP response
        if (sapResponse && sapResponse[0]) {
          const responseObj = sapResponse[0];
          
          // Check for error messages
          if (responseObj['EV_MESSAGE'] || responseObj['ET_RETURN']) {
            console.log('SAP Error Message:', responseObj['EV_MESSAGE'] ? responseObj['EV_MESSAGE'][0] : 'No message');
            console.log('SAP Return Table:', responseObj['ET_RETURN'] ? JSON.stringify(responseObj['ET_RETURN'], null, 2) : 'No return table');
          }
          
          // Check all available fields in response
          console.log('All SAP Response Fields:', Object.keys(responseObj));
        }

        if (sapResponse && sapResponse[0] && sapResponse[0]['EV_PDF']) {
          const pdfBase64 = sapResponse[0]['EV_PDF'][0];
          
          console.log('PDF Base64 length:', pdfBase64 ? pdfBase64.length : 0);
          console.log('PDF Base64 first 100 chars:', pdfBase64 ? pdfBase64.substring(0, 100) : 'empty');
          
          // Check if PDF data is actually present
          if (pdfBase64 && pdfBase64.trim() !== '') {
            console.log('Valid PDF data found from SAP, returning to client');
            res.json({
              success: true,
              message: 'Invoice PDF retrieved successfully from SAP',
              data: {
                pdfBase64: pdfBase64,
                documentNumber: documentNumber,
                customerId: customerId,
                fileName: `Invoice_${documentNumber}_${customerId}.pdf`
              }
            });
          } else {
            console.log('SAP returned empty PDF data for document:', documentNumber);
            // Generate fallback PDF using simple method
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

  if (payageData && payageData['item']) {
    const items = Array.isArray(payageData['item']) ? payageData['item'] : [payageData['item']];
    
    items.forEach(item => {
      const documentNumber = item['VBELN'] ? item['VBELN'][0] : 'N/A';
      const billingDate = item['FKDAT'] ? formatSAPDate(item['FKDAT'][0]) : 'N/A';
      const dueDate = item['DUE_DATE'] ? formatSAPDate(item['DUE_DATE'][0]) : 'N/A';
      const amount = item['NETWR'] ? parseFloat(item['NETWR'][0]) || 0 : 0;
      const currency = item['WAERK'] ? item['WAERK'][0] : 'EUR';
      const agingDays = item['AGEING_DAYS'] ? parseInt(item['AGEING_DAYS'][0]) || 0 : 0;
      
      // Determine status based on aging days
      let status = 'Paid';
      if (agingDays > 0) {
        if (agingDays <= 30) status = 'Due';
        else if (agingDays <= 60) status = 'Overdue';
        else status = 'Critical';
      }

      invoiceList.push({
        invoiceNumber: documentNumber,
        invoiceDate: billingDate,
        dueDate: dueDate,
        amount: amount,
        status: status,
        description: `Invoice ${documentNumber}`,
        documentName: `Invoice_${documentNumber}.pdf`,
        currency: currency,
        agingDays: agingDays,
        customerId: customerId
      });
    });
  }

  return invoiceList;
}

// Function to format SAP date (YYYYMMDD to YYYY-MM-DD)
function formatSAPDate(sapDate) {
  if (!sapDate || sapDate === '00000000') return null;
  
  const dateStr = sapDate.toString();
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  return sapDate;
}

// Mock invoice data function
function getMockInvoiceData(customerId) {
  return [
    {
      invoiceNumber: '9000000001',
      invoiceDate: '2024-12-15',
      dueDate: '2025-01-14',
      amount: 1232.00,
      currency: 'SAR',
      status: 'Paid',
      description: 'Product Sales Invoice',
      documentName: 'Invoice_9000000001.pdf'
    },
    {
      invoiceNumber: '9000000002',
      invoiceDate: '2024-12-10',
      dueDate: '2025-01-09',
      amount: 1540.00,
      currency: 'SAR',
      status: 'Open',
      description: 'Service Invoice',
      documentName: 'Invoice_9000000002.pdf'
    },
    {
      invoiceNumber: '9000000003',
      invoiceDate: '2024-11-28',
      dueDate: '2024-12-28',
      amount: 2800.00,
      currency: 'SAR',
      status: 'Overdue',
      description: 'Equipment Sales',
      documentName: 'Invoice_9000000003.pdf'
    },
    {
      invoiceNumber: '9000000004',
      invoiceDate: '2024-11-15',
      dueDate: '2024-12-15',
      amount: 642.00,
      currency: 'SAR',
      status: 'Open',
      description: 'Maintenance Services',
      documentName: 'Invoice_9000000004.pdf'
    },
    {
      invoiceNumber: '9000000005',
      invoiceDate: '2024-11-05',
      dueDate: '2024-12-05',
      amount: 1320.00,
      currency: 'SAR',
      status: 'Paid',
      description: 'Software License',
      documentName: 'Invoice_9000000005.pdf'
    }
  ];
}

// Generate enhanced PDF using actual invoice data from SAP
async function generateEnhancedInvoicePDF(documentNumber, customerId) {
  try {
    // Fetch invoice details from payment aging data
    const invoiceData = await fetchInvoiceDetailsFromSAP(documentNumber, customerId);
    
    if (!invoiceData) {
      return generateFallbackPDF(documentNumber, customerId);
    }

    // Create enhanced PDF with actual invoice data
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
/F2 5 0 R
>>
>>
/MediaBox [0 0 612 792]
/Contents 6 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

6 0 obj
<<
/Length 800
>>
stream
BT
/F1 16 Tf
72 720 Td
(INVOICE) Tj
0 -30 Td
/F2 12 Tf
(Document Number: ${documentNumber}) Tj
0 -20 Td
(Customer ID: ${customerId}) Tj
0 -20 Td
(Invoice Date: ${invoiceData.invoiceDate || 'N/A'}) Tj
0 -20 Td
(Due Date: ${invoiceData.dueDate || 'N/A'}) Tj
0 -20 Td
(Amount: ${invoiceData.amount || '0.00'} ${invoiceData.currency || 'SAR'}) Tj
0 -20 Td
(Status: ${invoiceData.status || 'Active'}) Tj
0 -30 Td
/F1 12 Tf
(Bill To:) Tj
0 -20 Td
/F2 10 Tf
(Customer: ${invoiceData.customerName || customerId}) Tj
0 -15 Td
(Address: ${invoiceData.address || 'Address not available'}) Tj
0 -30 Td
/F1 12 Tf
(Invoice Details:) Tj
0 -20 Td
/F2 10 Tf
(Description: ${invoiceData.description || 'Invoice for services/products'}) Tj
0 -15 Td
(Payment Terms: ${invoiceData.paymentTerms || '30 days'}) Tj
0 -30 Td
(Generated on: ${new Date().toLocaleDateString()}) Tj
0 -15 Td
(This invoice was generated from SAP data.) Tj
ET
endstream
endobj

xref
0 7
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000105 00000 n 
0000000251 00000 n 
0000000318 00000 n 
0000000378 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
1250
%%EOF`;

    return Buffer.from(pdfContent, 'utf8').toString('base64');
  } catch (error) {
    console.error('Error generating enhanced PDF:', error);
    return generateFallbackPDF(documentNumber, customerId);
  }
}

// Fetch invoice details from SAP payment aging service
async function fetchInvoiceDetailsFromSAP(documentNumber, customerId) {
  try {
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                    xmlns:urn="urn:sap-com:document:sap:rfc:functions">
    <soapenv:Header/>
    <soapenv:Body>
      <urn:ZCUST_PORTAL_PAYAGE_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
      </urn:ZCUST_PORTAL_PAYAGE_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_payage_service?sap-client=100',
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

    const result = await new Promise((resolve, reject) => {
      parseString(response.data, (err, parsed) => {
        if (err) reject(err);
        else resolve(parsed);
      });
    });

    const envelope = result['soap-env:Envelope'] || result['soapenv:Envelope'];
    const body = envelope['soap-env:Body'] || envelope['soapenv:Body'];
    const sapResponse = body && body[0] && (
      body[0]['n0:ZCUST_PORTAL_PAYAGE_FMResponse'] || 
      body[0]['ns0:ZCUST_PORTAL_PAYAGE_FMResponse'] ||
      body[0]['urn:ZCUST_PORTAL_PAYAGE_FMResponse']
    );

    if (sapResponse && sapResponse[0] && sapResponse[0]['EV_PAYAGE']) {
      const payageData = sapResponse[0]['EV_PAYAGE'][0];
      
      if (payageData && payageData['item']) {
        const items = Array.isArray(payageData['item']) ? payageData['item'] : [payageData['item']];
        
        // Find the specific document
        const invoiceItem = items.find(item => {
          const docNumber = item['VBELN'] ? item['VBELN'][0] : '';
          return docNumber === documentNumber;
        });

        if (invoiceItem) {
          return {
            invoiceDate: invoiceItem['FKDAT'] ? formatSAPDate(invoiceItem['FKDAT'][0]) : null,
            dueDate: invoiceItem['DUE_DATE'] ? formatSAPDate(invoiceItem['DUE_DATE'][0]) : null,
            amount: invoiceItem['NETWR'] ? parseFloat(invoiceItem['NETWR'][0]) : 0,
            currency: invoiceItem['WAERK'] ? invoiceItem['WAERK'][0] : 'SAR',
            status: 'Active',
            customerName: invoiceItem['CUSTOMER_NAME'] ? invoiceItem['CUSTOMER_NAME'][0] : customerId,
            address: invoiceItem['ADDRESS'] ? invoiceItem['ADDRESS'][0] : 'Address not available',
            description: `Invoice ${documentNumber}`,
            paymentTerms: '30 days'
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching invoice details from SAP:', error);
    return null;
  }
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
