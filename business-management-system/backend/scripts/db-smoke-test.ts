import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runSmokeTest() {
  console.log('==================================================');
  console.log('  BMS PostgreSQL Database Smoke Test (Prisma ORM) ');
  console.log('==================================================');

  const testKey = `smoke_test_${Date.now()}`;
  let passed = true;

  try {
    // Step 1: Check basic connectivity
    console.log('[1/5] Testing basic connectivity (SELECT 1)...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('      PASS: PostgreSQL is connected and responsive.');

    // Step 2: Insert temporary setting record
    console.log(`[2/5] Inserting temporary setting record (${testKey})...`);
    const created = await prisma.systemSetting.create({
      data: {
        key: testKey,
        value: 'initial_phase1_value',
        description: 'Smoke test verification entry',
      },
    });
    console.log(`      PASS: Record inserted with ID: ${created.id}`);

    // Step 3: Read back record
    console.log('[3/5] Reading back inserted record...');
    const fetched = await prisma.systemSetting.findUnique({
      where: { key: testKey },
    });
    if (!fetched || fetched.value !== 'initial_phase1_value') {
      throw new Error('Read verification failed: retrieved record mismatch');
    }
    console.log('      PASS: Record read and content verified.');

    // Step 4: Update record
    console.log('[4/5] Updating record value...');
    const updated = await prisma.systemSetting.update({
      where: { key: testKey },
      data: { value: 'updated_phase1_value' },
    });
    if (updated.value !== 'updated_phase1_value') {
      throw new Error('Update verification failed');
    }
    console.log('      PASS: Record updated successfully.');

    // Step 5: Clean up record
    console.log('[5/5] Cleaning up temporary record...');
    await prisma.systemSetting.delete({
      where: { key: testKey },
    });

    const verifyDeleted = await prisma.systemSetting.findUnique({
      where: { key: testKey },
    });
    if (verifyDeleted !== null) {
      throw new Error('Cleanup verification failed: record still exists');
    }
    console.log('      PASS: Temporary record deleted cleanly.');

    console.log('--------------------------------------------------');
    console.log('  ALL DATABASE SMOKE TEST STEPS PASSED (5/5)       ');
    console.log('==================================================');
  } catch (err: unknown) {
    passed = false;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('      FAIL: Smoke test encountered an error:');
    console.error('     ', errorMsg);
    console.log('--------------------------------------------------');
    console.log('  DATABASE SMOKE TEST FAILED                       ');
    console.log('==================================================');
  } finally {
    await prisma.$disconnect();
    if (!passed) {
      process.exit(1);
    }
  }
}

runSmokeTest();

