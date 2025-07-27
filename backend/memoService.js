const express = require('express');
const axios = require('axios');
const { parseString } = require('xml2js');

const router = express.Router();

// GET /api/customer/memos/:customerId
router.get('/memos/:customerId', async (req, res) => {
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
      <urn:ZCUST_MEMO_FM>
        <IV_KUNNR>${customerId}</IV_KUNNR>
      </urn:ZCUST_MEMO_FM>
    </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    console.log(`Fetching memo data for customer: ${customerId}`);
    
    const response = await axios.post(
      'http://AZKTLDS5CP.kcloud.com:8000/sap/bc/srt/scs/sap/zcust_memo_service?sap-client=100',
      soapEnvelope,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'urn:sap-com:document:sap:rfc:functions:ZCUST_MEMO_FM',
          'Authorization': 'Basic ' + Buffer.from('K901705:Sameena@1911').toString('base64')
        },
        timeout: 30000
      }
    );

    console.log('SAP response received for memo data');

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

        // Extract credit and debit memos from SAP response
        const memoData = parseMemoData(result);
        
        res.json({
          success: true,
          message: 'Memo data retrieved successfully',
          data: memoData,
          sapResponse: result
        });

      } catch (parseError) {
        console.error('Error processing memo data:', parseError);
        res.status(500).json({ 
          success: false, 
          message: 'Error processing memo data from SAP',
          error: parseError.message 
        });
      }
    });

  } catch (error) {
    console.error('Error fetching memo data from SAP:', error.message);
    
    // Return mock data for development
    const mockMemoData = {
      creditMemos: [
        {
          vbeln: 'CM001',
          fkart: 'G2',
          fkdat: '2024-01-15',
          waerk: 'EUR',
          netwr: -250.00,
          kunag: customerId,
          bukrs: '1000',
          description: 'Credit Memo for Return'
        },
        {
          vbeln: 'CM002',
          fkart: 'G2',
          fkdat: '2024-02-20',
          waerk: 'EUR',
          netwr: -180.50,
          kunag: customerId,
          bukrs: '1000',
          description: 'Credit Memo for Discount'
        }
      ],
      debitMemos: [
        {
          vbeln: 'DM001',
          fkart: 'L2',
          fkdat: '2024-01-10',
          waerk: 'EUR',
          netwr: 75.00,
          kunag: customerId,
          bukrs: '1000',
          description: 'Debit Memo for Additional Charges'
        },
        {
          vbeln: 'DM002',
          fkart: 'L2',
          fkdat: '2024-03-05',
          waerk: 'EUR',
          netwr: 120.25,
          kunag: customerId,
          bukrs: '1000',
          description: 'Debit Memo for Service Fee'
        }
      ]
    };

    res.json({
      success: true,
      message: 'Memo data retrieved successfully (mock data)',
      data: mockMemoData,
      isMockData: true
    });
  }
});

function parseMemoData(sapResponse) {
  const memoData = {
    creditMemos: [],
    debitMemos: []
  };

  try {
    // Navigate through the SOAP response structure
    const envelope = sapResponse['soap-env:Envelope'] || sapResponse.Envelope;
    const body = envelope['soap-env:Body'] || envelope.Body;
    const memoResponse = body['n0:ZCUST_MEMO_FMResponse'] || body.ZCUST_MEMO_FMResponse;

    if (memoResponse) {
      // Parse credit memos
      const creditMemos = memoResponse.ET_CREDIT_MEMOS || memoResponse.et_credit_memos;
      if (creditMemos && creditMemos.item) {
        const creditArray = Array.isArray(creditMemos.item) ? creditMemos.item : [creditMemos.item];
        creditArray.forEach(memo => {
          memoData.creditMemos.push({
            vbeln: memo.VBELN || memo.vbeln || '',
            fkart: memo.FKART || memo.fkart || 'G2',
            fkdat: memo.FKDAT || memo.fkdat || '',
            waerk: memo.WAERK || memo.waerk || 'EUR',
            netwr: parseFloat(memo.NETWR || memo.netwr || 0),
            kunag: memo.KUNAG || memo.kunag || '',
            bukrs: memo.BUKRS || memo.bukrs || '',
            description: 'Credit Memo'
          });
        });
      }

      // Parse debit memos
      const debitMemos = memoResponse.ET_DEBIT_MEMOS || memoResponse.et_debit_memos;
      if (debitMemos && debitMemos.item) {
        const debitArray = Array.isArray(debitMemos.item) ? debitMemos.item : [debitMemos.item];
        debitArray.forEach(memo => {
          memoData.debitMemos.push({
            vbeln: memo.VBELN || memo.vbeln || '',
            fkart: memo.FKART || memo.fkart || 'L2',
            fkdat: memo.FKDAT || memo.fkdat || '',
            waerk: memo.WAERK || memo.waerk || 'EUR',
            netwr: parseFloat(memo.NETWR || memo.netwr || 0),
            kunag: memo.KUNAG || memo.kunag || '',
            bukrs: memo.BUKRS || memo.bukrs || '',
            description: 'Debit Memo'
          });
        });
      }
    }

    console.log('Parsed memo data:', memoData);
    return memoData;

  } catch (error) {
    console.error('Error parsing memo data:', error);
    return {
      creditMemos: [],
      debitMemos: []
    };
  }
}

module.exports = router;
