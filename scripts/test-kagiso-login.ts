import { authService } from '../server/services/auth.service';
import { suppliersRepository } from '../server/repositories/suppliers.repository';
import { pool } from '../server/db/client';

async function testKagisoFlow() {
  console.log('--- Testing Kagiso Login & Profile Retrieval ---');

  // 1. Test Login
  const loginRes = await authService.login('kagiso@phiricontracting.co.bw', 'Password123!', '127.0.0.1');
  console.log('1. Login successful!');
  console.log('   Token generated:', !!loginRes.token);
  console.log('   User:', loginRes.user?.email, loginRes.user?.id);
  console.log('   Active Memberships:', loginRes.user?.memberships);

  const supplierId = loginRes.user?.memberships[0]?.tenantId;
  console.log('   Linked Supplier ID:', supplierId);

  // 2. Test Profile Retrieval from suppliers table
  if (supplierId) {
    const profile = await suppliersRepository.getById(supplierId);
    console.log('\n2. Profile fetched from PostgreSQL suppliers table:');
    console.log('   Legal Name:', profile?.legalName);
    console.log('   Trading Name:', profile?.tradingName);
    console.log('   CIPA UIN:', profile?.cipaUin);
    console.log('   Email:', profile?.email);
    console.log('   City:', profile?.city);
    console.log('   Completeness:', profile?.profileCompleteness);

    // 3. Test Profile Update in suppliers table
    console.log('\n3. Testing profile update (e.g. changing description & year established)...');
    const updated = await suppliersRepository.updateProfile(supplierId, {
      description: 'Building and civil works contractor based in Gaborone.',
      yearEstablished: 2019,
      postalAddress: 'P.O. Box 50223, Gaborone',
      physicalAddress: 'Plot 21405, Phakalane Industrial',
    });
    console.log('   Update result from PostgreSQL:');
    console.log('   Description:', updated.description);
    console.log('   Year Established:', updated.yearEstablished);
    console.log('   Physical Address:', updated.physicalAddress);
  }

  await pool.end();
}

testKagisoFlow().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
