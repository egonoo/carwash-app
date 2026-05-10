import { HeroSection } from './_components/HeroSection';
import { FeaturesGrid } from './_components/FeaturesGrid';
import { DashboardShowcase } from './_components/DashboardShowcase';
import { MobileWorkflow } from './_components/MobileWorkflow';
import { PricingPreview } from './_components/PricingPreview';
import { CTASection } from './_components/CTASection';

export default function MarketingHome() {
  return (
    <>
      <HeroSection />
      <FeaturesGrid />
      <DashboardShowcase />
      <MobileWorkflow />
      <PricingPreview />
      <CTASection />
    </>
  );
}
