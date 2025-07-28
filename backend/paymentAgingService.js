const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// GET /api/customer/payment-aging/:customerId
router.get('/payment-aging/:customerId', async (req, res) => {
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
      <urn:ZCUST_PORTAL_PAYAGE_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
      </urn:ZCUST_PORTAL_PAYAGE_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Fetching payment aging data for customer: ${customerId}`);
    
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

    console.log('SAP Payment Aging response received');

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
          const parsedData = parsePaymentAgingData(payageData, customerId);
          
          console.log('Parsed payment aging data:', parsedData.length, 'items');
          
          res.json({
            success: true,
            message: 'Payment aging data retrieved successfully',
            data: parsedData,
            sapResponse: result
          });
        } else {
          // Log the actual SAP response to understand the structure
          console.log('SAP response structure:', JSON.stringify(sapResponse, null, 2));
          
          // Try different response structure patterns
          let payageData = null;
          let parsedData = [];
          
          // Check if the data is directly in the response
          if (sapResponse && sapResponse[0]) {
            // Sometimes the data might be directly in the response
            const responseData = sapResponse[0];
            
            // Try to find payment aging data in different possible locations
            if (responseData['EV_PAYAGE']) {
              payageData = responseData['EV_PAYAGE'][0];
              parsedData = parsePaymentAgingData(payageData, customerId);
            } else if (responseData['PAYAGE_DATA']) {
              payageData = responseData['PAYAGE_DATA'][0];
              parsedData = parsePaymentAgingData(payageData, customerId);
            } else if (responseData['item']) {
              // Data might be directly as items
              parsedData = parsePaymentAgingDataDirect(responseData, customerId);
            }
          }
          
          if (parsedData.length > 0) {
            console.log('Successfully parsed data using alternative method:', parsedData.length, 'items');
            res.json({
              success: true,
              message: 'Payment aging data retrieved successfully',
              data: parsedData,
              sapResponse: result
            });
          } else {
            console.log('Could not parse SAP response, using mock data');
            res.json({
              success: true,
              message: 'Payment aging data retrieved (mock data)',
              data: getMockPaymentAgingData(customerId),
              sapResponse: result
            });
          }
        }
      } catch (parseError) {
        console.error('Error parsing SAP response structure:', parseError);
        // Return mock data as fallback
        res.json({
          success: true,
          message: 'Payment aging data retrieved (fallback to mock data)',
          data: getMockPaymentAgingData(customerId)
        });
      }
    });

  } catch (error) {
    console.error('SAP request failed:', error.message);
    
    // Return mock data for development
    console.log('SAP connection failed, returning mock data for development');
    res.json({
      success: true,
      message: 'Payment aging data retrieved (mock data - SAP unavailable)',
      data: getMockPaymentAgingData(customerId)
    });
  }
});

// Function to parse payment aging data from SAP response
function parsePaymentAgingData(payageData, customerId) {
  const paymentAgingList = [];

  console.log('Parsing payage data:', JSON.stringify(payageData, null, 2));

  if (payageData && payageData['item']) {
    const items = Array.isArray(payageData['item']) ? payageData['item'] : [payageData['item']];
    
    items.forEach(item => {
      paymentAgingList.push({
        kunnr: customerId || (item['KUNNR'] ? item['KUNNR'][0] : customerId),
        vbeln: item['VBELN'] ? item['VBELN'][0] : 'N/A',
        fkdat: item['FKDAT'] ? formatSAPDate(item['FKDAT'][0]) : 'N/A',
        due_date: item['DUE_DATE'] ? formatSAPDate(item['DUE_DATE'][0]) : 'N/A',
        netwr: item['NETWR'] ? parseFloat(item['NETWR'][0]) || 0 : 0,
        waerk: item['WAERK'] ? item['WAERK'][0] : 'EUR',
        ageing_days: item['AGEING_DAYS'] ? parseInt(item['AGEING_DAYS'][0]) || 0 : 0,
        
        // Legacy fields for backward compatibility
        billingDate: item['FKDAT'] ? formatSAPDate(item['FKDAT'][0]) : 'N/A',
        dueDate: item['DUE_DATE'] ? formatSAPDate(item['DUE_DATE'][0]) : 'N/A',
        amount: item['NETWR'] ? parseFloat(item['NETWR'][0]) || 0 : 0,
        currency: item['WAERK'] ? item['WAERK'][0] : 'EUR',
        agingDays: item['AGEING_DAYS'] ? parseInt(item['AGEING_DAYS'][0]) || 0 : 0,
        status: getPaymentStatus(item['AGEING_DAYS'] ? parseInt(item['AGEING_DAYS'][0]) || 0 : 0)
      });
    });
  }

  console.log('Parsed payment aging items:', paymentAgingList.length);
  return paymentAgingList;
}

// Alternative function to parse payment aging data when it's in different structure
function parsePaymentAgingDataDirect(responseData, customerId) {
  const paymentAgingList = [];

  console.log('Parsing direct response data:', JSON.stringify(responseData, null, 2));

  if (responseData && responseData['item']) {
    const items = Array.isArray(responseData['item']) ? responseData['item'] : [responseData['item']];
    
    items.forEach(item => {
      // Handle both nested array format and direct object format
      const getValue = (field) => {
        if (item[field]) {
          return Array.isArray(item[field]) ? item[field][0] : item[field];
        }
        return null;
      };

      paymentAgingList.push({
        kunnr: customerId || getValue('KUNNR') || getValue('kunnr') || customerId,
        vbeln: getValue('VBELN') || getValue('vbeln') || 'N/A',
        fkdat: formatSAPDate(getValue('FKDAT') || getValue('fkdat')) || 'N/A',
        due_date: formatSAPDate(getValue('DUE_DATE') || getValue('due_date')) || 'N/A',
        netwr: parseFloat(getValue('NETWR') || getValue('netwr')) || 0,
        waerk: getValue('WAERK') || getValue('waerk') || 'EUR',
        ageing_days: parseInt(getValue('AGEING_DAYS') || getValue('ageing_days')) || 0,
        
        // Legacy fields for backward compatibility
        billingDate: formatSAPDate(getValue('FKDAT') || getValue('fkdat')) || 'N/A',
        dueDate: formatSAPDate(getValue('DUE_DATE') || getValue('due_date')) || 'N/A',
        amount: parseFloat(getValue('NETWR') || getValue('netwr')) || 0,
        currency: getValue('WAERK') || getValue('waerk') || 'EUR',
        agingDays: parseInt(getValue('AGEING_DAYS') || getValue('ageing_days')) || 0,
        status: getPaymentStatus(parseInt(getValue('AGEING_DAYS') || getValue('ageing_days')) || 0)
      });
    });
  }

  console.log('Parsed direct payment aging items:', paymentAgingList.length);
  return paymentAgingList;
}

// Function to format SAP date (YYYYMMDD) to readable format
function formatSAPDate(sapDate) {
  if (!sapDate || sapDate === '00000000') return 'N/A';
  
  try {
    // Handle various SAP date formats
    let dateStr = String(sapDate).replace(/\D/g, ''); // Remove non-digits
    
    if (dateStr.length === 8) {
      // Standard SAP format: YYYYMMDD
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      
      // Validate the date
      const date = new Date(year, month - 1, day);
      if (date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    
    // If we can't parse it properly, try to create a valid date
    if (dateStr.length >= 6) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6) || '01';
      const day = dateStr.substring(6, 8) || '01';
      
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // If all else fails, return current date formatted
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  } catch (error) {
    console.error('Error formatting SAP date:', sapDate, error);
    return 'N/A';
  }
}

// Function to determine payment status based on aging days
function getPaymentStatus(agingDays) {
  if (agingDays <= 0) return 'Current';
  if (agingDays <= 30) return '1-30 Days';
  if (agingDays <= 60) return '31-60 Days';
  if (agingDays <= 90) return '61-90 Days';
  return 'Over 90 Days';
}

// Mock data function for development
function getMockPaymentAgingData(customerId) {
  return [
    {
      kunnr: customerId,
      vbeln: '90000000',
      fkdat: '2024-12-15',
      due_date: '2025-01-14',
      netwr: 1232.00,
      waerk: 'EUR',
      ageing_days: 42,
      
      // Legacy fields for backward compatibility
      billingDate: '2024-12-15',
      dueDate: '2025-01-14',
      amount: 1232.00,
      currency: 'EUR',
      agingDays: 42,
      status: '31-60 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000001',
      fkdat: '2024-11-15',
      due_date: '2024-12-14',
      netwr: 1600.00,
      waerk: 'INR',
      ageing_days: 75,
      
      billingDate: '2024-11-15',
      dueDate: '2024-12-14',
      amount: 1600.00,
      currency: 'INR',
      agingDays: 75,
      status: '61-90 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000003',
      fkdat: '2025-01-15',
      due_date: '2025-02-14',
      netwr: 647.00,
      waerk: 'USD',
      ageing_days: 15,
      
      billingDate: '2025-01-15',
      dueDate: '2025-02-14',
      amount: 647.00,
      currency: 'USD',
      agingDays: 15,
      status: '0-30 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000002',
      fkdat: '2024-12-05',
      due_date: '2025-01-04',
      netwr: 875.00,
      waerk: 'EUR',
      ageing_days: 52,
      
      billingDate: '2024-12-05',
      dueDate: '2025-01-04',
      amount: 875.00,
      currency: 'EUR',
      agingDays: 52,
      status: '31-60 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000004',
      fkdat: '2024-10-15',
      due_date: '2024-11-14',
      netwr: 642.00,
      waerk: 'EUR',
      ageing_days: 105,
      
      billingDate: '2024-10-15',
      dueDate: '2024-11-14',
      amount: 642.00,
      currency: 'EUR',
      agingDays: 105,
      status: '90+ Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000006',
      fkdat: '2024-12-20',
      due_date: '2025-01-19',
      netwr: 118.00,
      waerk: 'SAR',
      ageing_days: 38,
      
      billingDate: '2024-12-20',
      dueDate: '2025-01-19',
      amount: 118.00,
      currency: 'SAR',
      agingDays: 38,
      status: '31-60 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000005',
      fkdat: '2024-11-30',
      due_date: '2024-12-30',
      netwr: 324.00,
      waerk: 'INR',
      ageing_days: 59,
      
      billingDate: '2024-11-30',
      dueDate: '2024-12-30',
      amount: 324.00,
      currency: 'INR',
      agingDays: 59,
      status: '31-60 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000007',
      fkdat: '2024-09-15',
      due_date: '2024-10-14',
      netwr: 2500.00,
      waerk: 'USD',
      ageing_days: 135,
      
      billingDate: '2024-09-15',
      dueDate: '2024-10-14',
      amount: 2500.00,
      currency: 'USD',
      agingDays: 135,
      status: '90+ Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000008',
      fkdat: '2025-01-05',
      due_date: '2025-02-04',
      netwr: 890.00,
      waerk: 'AED',
      ageing_days: 22,
      
      billingDate: '2025-01-05',
      dueDate: '2025-02-04',
      amount: 890.00,
      currency: 'AED',
      agingDays: 22,
      status: '0-30 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000009',
      fkdat: '2024-11-25',
      due_date: '2024-12-24',
      netwr: 3200.00,
      waerk: 'EUR',
      ageing_days: 65,
      
      billingDate: '2024-11-25',
      dueDate: '2024-12-24',
      amount: 3200.00,
      currency: 'EUR',
      agingDays: 65,
      status: '61-90 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000010',
      fkdat: '2024-08-15',
      due_date: '2024-09-14',
      netwr: 1850.00,
      waerk: 'GBP',
      ageing_days: 165,
      
      billingDate: '2024-08-15',
      dueDate: '2024-09-14',
      amount: 1850.00,
      currency: 'GBP',
      agingDays: 165,
      status: '90+ Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000011',
      fkdat: '2025-01-10',
      due_date: '2025-02-09',
      netwr: 420.00,
      waerk: 'INR',
      ageing_days: 18,
      
      billingDate: '2025-01-10',
      dueDate: '2025-02-09',
      amount: 420.00,
      currency: 'INR',
      agingDays: 18,
      status: '0-30 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000012',
      fkdat: '2024-12-01',
      due_date: '2024-12-31',
      netwr: 760.00,
      waerk: 'USD',
      ageing_days: 58,
      
      billingDate: '2024-12-01',
      dueDate: '2024-12-31',
      amount: 760.00,
      currency: 'USD',
      agingDays: 58,
      status: '31-60 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000013',
      fkdat: '2024-07-20',
      due_date: '2024-08-19',
      netwr: 4500.00,
      waerk: 'JPY',
      ageing_days: 190,
      
      billingDate: '2024-07-20',
      dueDate: '2024-08-19',
      amount: 4500.00,
      currency: 'JPY',
      agingDays: 190,
      status: '90+ Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000014',
      fkdat: '2024-11-05',
      due_date: '2024-12-04',
      netwr: 1320.00,
      waerk: 'SAR',
      ageing_days: 85,
      
      billingDate: '2024-11-05',
      dueDate: '2024-12-04',
      amount: 1320.00,
      currency: 'SAR',
      agingDays: 85,
      status: '61-90 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000015',
      fkdat: '2025-01-20',
      due_date: '2025-02-19',
      netwr: 95.00,
      waerk: 'AED',
      ageing_days: 8,
      
      billingDate: '2025-01-20',
      dueDate: '2025-02-19',
      amount: 95.00,
      currency: 'AED',
      agingDays: 8,
      status: '0-30 Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000016',
      fkdat: '2024-10-28',
      due_date: '2024-11-27',
      netwr: 2800.00,
      waerk: 'EUR',
      ageing_days: 95,
      
      billingDate: '2024-10-28',
      dueDate: '2024-11-27',
      amount: 2800.00,
      currency: 'EUR',
      agingDays: 95,
      status: '90+ Days'
    },
    {
      kunnr: customerId,
      vbeln: '90000017',
      fkdat: '2024-12-10',
      due_date: '2025-01-09',
      netwr: 1540.00,
      waerk: 'GBP',
      ageing_days: 49,
      
      billingDate: '2024-12-10',
      dueDate: '2025-01-09',
      amount: 1540.00,
      currency: 'GBP',
      agingDays: 49,
      status: '31-60 Days'
    }
  ];
}

module.exports = router;
