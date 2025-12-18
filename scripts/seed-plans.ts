import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subscriptionPlans = [
  {
    name: 'FREE',
    basePricePerSeat: 0,
    usageMarkup: 0,
    features: JSON.stringify([
      '1 project',
      '1GB storage',
      '10GB bandwidth/month',
      'Community support',
    ]),
  },
  {
    name: 'STARTER',
    basePricePerSeat: 900, // $9/month in cents
    usageMarkup: 0.1, // 10% markup on usage
    features: JSON.stringify([
      '5 projects',
      '10GB storage',
      '100GB bandwidth/month',
      'Email support',
      'Custom domains',
    ]),
  },
  {
    name: 'PRO',
    basePricePerSeat: 2900, // $29/month in cents
    usageMarkup: 0.05, // 5% markup on usage
    features: JSON.stringify([
      'Unlimited projects',
      '100GB storage',
      '1TB bandwidth/month',
      'Priority support',
      'Custom domains',
      'Team collaboration',
      'Advanced analytics',
    ]),
  },
  {
    name: 'ENTERPRISE',
    basePricePerSeat: 9900, // $99/month in cents
    usageMarkup: 0, // No markup
    features: JSON.stringify([
      'Unlimited projects',
      'Unlimited storage',
      'Unlimited bandwidth',
      '24/7 dedicated support',
      'Custom domains',
      'Team collaboration',
      'Advanced analytics',
      'SLA guarantee',
      'Custom integrations',
      'SSO/SAML',
    ]),
  },
];

async function seed() {
  console.log('Seeding subscription plans...');

  for (const plan of subscriptionPlans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name: plan.name },
    });

    if (existing) {
      console.log(`  Plan "${plan.name}" already exists, updating...`);
      await prisma.subscriptionPlan.update({
        where: { name: plan.name },
        data: plan,
      });
    } else {
      console.log(`  Creating plan "${plan.name}"...`);
      await prisma.subscriptionPlan.create({
        data: plan,
      });
    }
  }

  console.log('Done seeding subscription plans!');

  // List all plans
  const plans = await prisma.subscriptionPlan.findMany();
  console.log('\nCurrent subscription plans:');
  for (const plan of plans) {
    console.log(`  - ${plan.name}: $${plan.basePricePerSeat / 100}/seat/month`);
  }
}

seed()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
