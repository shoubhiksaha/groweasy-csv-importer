const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname);

// 1. Messy columns and newlines
const messyCsv = `Full Name,Contact Info,Remarks,Lead Status
John Doe,john@example.com / +919876543210,"Wants a demo\\nCall back later",interested
Jane Smith,+918888888888,"No email provided",BAD_LEAD
Bob,bob@example.com / bob2@example.com,"Multiple emails",SALE_DONE
Empty Row,,,
`;
fs.writeFileSync(path.join(testDir, 'messy_leads.csv'), messyCsv);

// 2. Real estate CRM export
const realEstateCsv = `Date,Client Name,Phone,Email,Project,Status,Budget
2026-06-01,Alice Real,+91 999 888 7777,alice@real.com,meridian_tower,GOOD_LEAD_FOLLOW_UP,1Cr
2026-06-02,Bob Estate,9876543210,,eden_park,DID_NOT_CONNECT,50L
`;
fs.writeFileSync(path.join(testDir, 'real_estate_leads.csv'), realEstateCsv);

// 3. Huge file (5000 rows)
let hugeCsv = 'Name,Email,Phone,Source,Notes\n';
for (let i = 1; i <= 5000; i++) {
  hugeCsv += `User ${i},user${i}@test.com,9999900000,leads_on_demand,Auto generated row ${i}\n`;
}
fs.writeFileSync(path.join(testDir, 'huge_5000_leads.csv'), hugeCsv);

// 4. Missing phone/email (should trigger skip rules)
const skippedCsv = `First,Last,Notes,Company
Only,Name,Should be skipped,NoCompany
Valid,User,valid@email.com,Acme
`;
fs.writeFileSync(path.join(testDir, 'missing_contact_leads.csv'), skippedCsv);

// 5. Facebook Ads Export Format
const fbAdsCsv = `id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,full_name,phone_number,email
123,2026-07-01T10:00:00+0000,111,Ad1,222,Adset1,333,Campaign1,444,Form1,false,fb,FB User,+919000000001,fb@user.com
`;
fs.writeFileSync(path.join(testDir, 'facebook_ads_leads.csv'), fbAdsCsv);

// 6. Google Ads Export Format
const googleAdsCsv = `Lead ID,GCLID,Campaign Name,Ad Group Name,Lead Form Name,Date Submitted,User Phone,User Email,User Name
A1,B2,Search Campaign,Group 1,Form 1,2026-07-05 14:30:00,+919000000002,google@user.com,Google User
`;
fs.writeFileSync(path.join(testDir, 'google_ads_leads.csv'), googleAdsCsv);

console.log('Created 6 diverse test CSVs in test/');
