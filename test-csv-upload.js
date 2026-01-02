// Quick test script to check and reset cash balance
// Run this in your browser console at http://localhost:3000/dashboard

async function testUpload() {
  console.log('🧪 Testing CSV Upload and Cash Balance Update...\n');
  
  // 1. Check current company state
  const meRes = await fetch('/api/auth/me');
  const meData = await meRes.json();
  const companyId = meData.user.companies[0].id;
  console.log('📍 Company ID:', companyId);
  console.log('💰 Current Cash Balance:', meData.user.companies[0].cashBalance);
  
  // 2. Create a simple test CSV
  const testCSV = `Date,Description,Debit,Credit,Balance
2024-12-01,Opening Balance,0,0,1000000
2024-12-15,Test Expense,50000,0,950000
2024-12-31,Final Balance Check,0,0,950000`;
  
  // 3. Create FormData and upload
  const blob = new Blob([testCSV], { type: 'text/csv' });
  const file = new File([blob], 'test-statement.csv', { type: 'text/csv' });
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('companyId', companyId);
  
  console.log('\n📤 Uploading test CSV...');
  
  const uploadRes = await fetch('/api/banks', {
    method: 'POST',
    body: formData
  });
  
  const result = await uploadRes.json();
  
  if (uploadRes.ok) {
    console.log('✅ Upload successful!');
    console.log('📊 Summary:', result.summary);
    console.log('\n💰 Expected Cash Balance: ₹950,000 (₹9.5L)');
    console.log('💰 Actual New Balance:', result.summary.newCashBalance.toLocaleString());
    console.log('💸 Cash Change:', result.summary.cashBalanceChange.toLocaleString());
    
    // 4. Refresh to verify
    setTimeout(async () => {
      const checkRes = await fetch('/api/auth/me');
      const checkData = await checkRes.json();
      console.log('\n🔍 Verification after upload:');
      console.log('💰 Dashboard Cash Balance:', checkData.user.companies[0].cashBalance);
      
      if (checkData.user.companies[0].cashBalance === 950000) {
        console.log('✅ SUCCESS! Cash balance updated correctly!');
      } else {
        console.log('❌ FAILED! Cash balance not updated.');
        console.log('Expected: 950000, Got:', checkData.user.companies[0].cashBalance);
      }
    }, 1000);
  } else {
    console.log('❌ Upload failed:', result.error);
    console.log('Details:', result.details || result);
  }
}

// Run the test
testUpload();


