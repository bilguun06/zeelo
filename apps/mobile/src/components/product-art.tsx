import type { LoanCategory } from '@orgil/shared';
import type { AccentTile } from '@orgil/ui';
import { Briefcase, CalendarRange, Car, ShoppingBag, Wallet, Zap } from 'lucide-react-native';
import { GradientTile } from './three-d';

const ART: Record<LoanCategory, { Icon: typeof Wallet; tone: AccentTile }> = {
  CONSUMER: { Icon: ShoppingBag, tone: 'blue' },
  SHORT_TERM: { Icon: Zap, tone: 'amber' },
  BNPL: { Icon: CalendarRange, tone: 'mint' },
  SALARY: { Icon: Wallet, tone: 'violet' },
  VEHICLE: { Icon: Car, tone: 'ocean' },
  BUSINESS: { Icon: Briefcase, tone: 'rose' },
};

/** Raised gradient tile per product category (3D chip look). */
export function ProductArt({ category, size = 52 }: { category: LoanCategory; size?: number }) {
  const { Icon, tone } = ART[category];
  return (
    <GradientTile tone={tone} size={size} radius={size * 0.34}>
      <Icon size={size * 0.46} color="#fff" strokeWidth={2.2} />
    </GradientTile>
  );
}
