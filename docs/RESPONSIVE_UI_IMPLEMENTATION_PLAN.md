# Responsive UI/UX Implementation Plan
## Grace AI Dashboard - Mobile-First Redesign

**Created:** April 4, 2026  
**Objective:** Transform dashboard into fully responsive, mobile-first experience with modern navigation, animations, and loading effects

---

## 📱 Current State Analysis

### Desktop-Only Issues
- ❌ Sidebar is fixed 256px width - not responsive
- ❌ No mobile navigation/hamburger menu
- ❌ Tables overflow on small screens
- ❌ Cards don't stack properly on mobile
- ❌ No touch-optimized interactions
- ❌ Font sizes don't scale responsively
- ❌ No mobile-specific layouts

### Missing Features
- ❌ Animated page transitions
- ❌ Skeleton loading states
- ❌ Progressive disclosure patterns
- ❌ Touch gestures (swipe, pull-to-refresh)
- ❌ Optimized images for different screen sizes
- ❌ Mobile-friendly forms

---

## 🎯 Implementation Strategy

### Phase 1: Foundation (Week 1)
**Mobile-First Responsive Layout System**

#### 1.1 Install Dependencies
```bash
npm install framer-motion hamburger-react react-use
npm install @radix-ui/react-navigation-menu
```

#### 1.2 Create Responsive Breakpoint System
**File:** `@/lib/breakpoints.ts`
```typescript
export const breakpoints = {
  mobile: '0px',      // 0-639px
  tablet: '640px',    // 640-1023px
  desktop: '1024px',  // 1024-1279px
  wide: '1280px',     // 1280px+
} as const;

export const mediaQueries = {
  mobile: '@media (max-width: 639px)',
  tablet: '@media (min-width: 640px) and (max-width: 1023px)',
  desktop: '@media (min-width: 1024px)',
  wide: '@media (min-width: 1280px)',
} as const;
```

#### 1.3 Mobile Navigation Component
**File:** `@/components/layout/MobileNav.tsx`
```typescript
"use client";

import { useState, useRef } from "react";
import { useClickAway } from "react-use";
import { Squash as Hamburger } from "hamburger-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Activity,
  MessageSquare,
  ScrollText,
  Settings,
  DollarSign,
  Users,
  Contact,
  Send,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/overview", label: "Services", icon: Activity },
  { path: "/messages", label: "Messages", icon: MessageSquare },
  { path: "/logs", label: "Logs", icon: ScrollText },
  { path: "/config", label: "Configuration", icon: Settings },
  { path: "/usage", label: "Usage & Costs", icon: DollarSign },
  { path: "/users", label: "Users", icon: Users },
  { path: "/contacts", label: "Contacts", icon: Contact },
  { path: "/compose", label: "Send Message", icon: Send },
];

export function MobileNav({ agentStatus }: { agentStatus: "online" | "offline" | "loading" }) {
  const [isOpen, setOpen] = useState(false);
  const ref = useRef(null);
  const pathname = usePathname();

  useClickAway(ref, () => setOpen(false));

  return (
    <div ref={ref} className="lg:hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold">Grace</span>
          </Link>

          <div className="flex items-center gap-3">
            <Badge
              variant={agentStatus === "online" ? "default" : "secondary"}
              className={cn(
                "text-xs",
                agentStatus === "online" && "bg-green-500/20 text-green-400 border-green-500/30",
                agentStatus === "offline" && "bg-red-500/20 text-red-400 border-red-500/30"
              )}
            >
              {agentStatus === "loading" ? "..." : agentStatus}
            </Badge>
            <Hamburger toggled={isOpen} size={20} toggle={setOpen} />
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-16 bottom-0 z-40 bg-background/95 backdrop-blur-lg border-t border-border overflow-y-auto"
          >
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path;

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

#### 1.4 Responsive Dashboard Shell
**File:** `@/components/layout/DashboardShell.tsx` (Update)
```typescript
"use client";

import { ReactNode, useEffect, useState, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [agentStatus, setAgentStatus] = useState<"online" | "offline" | "loading">("loading");
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      const res = await fetch("/api/agent", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data.running ? "online" : "offline");
      } else {
        setAgentStatus("offline");
      }
    } catch {
      setAgentStatus("offline");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <>
      {/* Mobile Navigation */}
      <MobileNav agentStatus={agentStatus} />
      
      {/* Desktop Layout */}
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar - Hidden on mobile */}
        <div className="hidden lg:block">
          <Sidebar agentStatus={agentStatus} />
        </div>
        
        {/* Main Content - Responsive padding */}
        <main className="flex flex-1 flex-col overflow-hidden pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    </>
  );
}
```

---

### Phase 2: Responsive Components (Week 2)
**Make All Components Mobile-Friendly**

#### 2.1 Responsive Overview Page
**File:** `@/app/page.tsx` (Update)

**Changes:**
- Stack cards vertically on mobile: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Reduce padding on mobile: `p-4 md:p-6`
- Smaller text on mobile: `text-2xl md:text-3xl`
- Hide less important info on mobile
- Touch-friendly button sizes (min 44px)

```typescript
// Key responsive classes to add:
<div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  {/* Cards */}
</div>

<h2 className="text-xl md:text-2xl font-bold">Grace Agent</h2>

<div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
  {/* Stats */}
</div>
```

#### 2.2 Responsive Tables
**File:** `@/components/ui/responsive-table.tsx` (New)

```typescript
"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  headers: string[];
  rows: Array<Record<string, any>>;
  mobileCardView?: boolean;
}

export function ResponsiveTable({ headers, rows, mobileCardView = true }: ResponsiveTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  if (mobileCardView) {
    return (
      <>
        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {rows.map((row, index) => (
            <Card key={index} className="p-4">
              <button
                onClick={() => toggleRow(index)}
                className="w-full flex items-center justify-between"
              >
                <div className="text-left">
                  <p className="font-medium">{row[headers[0]]}</p>
                  <p className="text-sm text-muted-foreground">{row[headers[1]]}</p>
                </div>
                {expandedRows.has(index) ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              
              {expandedRows.has(index) && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {headers.slice(2).map((header) => (
                    <div key={header} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{header}:</span>
                      <span className="font-medium">{row[header]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {headers.map((header) => (
                    <TableCell key={header}>{row[header]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {headers.map((header) => (
                <TableCell key={header}>{row[header]}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

#### 2.3 Responsive Messages Page
**Updates:**
- Hide conversation list on mobile, show as drawer
- Full-width chat on mobile
- Swipe gestures to go back
- Touch-optimized message bubbles

---

### Phase 3: Animations & Loading (Week 3)
**Add Polish with Framer Motion**

#### 3.1 Page Transition Animations
**File:** `@/components/layout/PageTransition.tsx` (New)

```typescript
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

#### 3.2 Skeleton Loading States
**File:** `@/components/ui/skeleton-card.tsx` (New)

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-3 w-full" />
      </CardContent>
    </Card>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 3.3 Animated Cards
**File:** `@/components/ui/animated-card.tsx` (New)

```typescript
"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function AnimatedCard({ children, delay = 0, className }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.4,
        delay,
        ease: "easeOut",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card className={className}>{children}</Card>
    </motion.div>
  );
}
```

#### 3.4 Loading Button States
**File:** `@/components/ui/loading-button.tsx` (New)

```typescript
"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
}

export function LoadingButton({
  children,
  loading,
  loadingText,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      <motion.div
        className="flex items-center gap-2"
        animate={loading ? { opacity: 0.7 } : { opacity: 1 }}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? loadingText || "Loading..." : children}
      </motion.div>
    </Button>
  );
}
```

#### 3.5 Stagger Animation for Lists
**File:** `@/components/ui/stagger-list.tsx` (New)

```typescript
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface StaggerListProps {
  children: ReactNode[];
  className?: string;
}

export function StaggerList({ children, className }: StaggerListProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { opacity: 0, y: 20 },
            visible: { opacity: 1, y: 0 },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
```

---

### Phase 4: Touch Optimizations (Week 4)
**Mobile-Specific Enhancements**

#### 4.1 Pull-to-Refresh
**File:** `@/components/ui/pull-to-refresh.tsx` (New)

```typescript
"use client";

import { useState, useRef, ReactNode } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 100], [0, 1]);
  const rotate = useTransform(y, [0, 100], [0, 360]);

  const handleDragEnd = async () => {
    if (y.get() > 100 && !isRefreshing) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    y.set(0);
  };

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 100 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      style={{ y }}
      className="relative"
    >
      <motion.div
        style={{ opacity }}
        className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full flex items-center justify-center h-16"
      >
        <motion.div style={{ rotate }}>
          <RefreshCw className="h-6 w-6 text-primary" />
        </motion.div>
      </motion.div>
      {children}
    </motion.div>
  );
}
```

#### 4.2 Swipe Actions
**File:** `@/components/ui/swipeable-item.tsx` (New)

```typescript
"use client";

import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ReactNode } from "react";
import { Trash2, Archive } from "lucide-react";

interface SwipeableItemProps {
  children: ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
}

export function SwipeableItem({ children, onDelete, onArchive }: SwipeableItemProps) {
  const x = useMotionValue(0);
  const background = useTransform(
    x,
    [-200, 0, 200],
    ["rgb(239, 68, 68)", "rgb(255, 255, 255)", "rgb(34, 197, 94)"]
  );

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x < -150 && onDelete) {
      onDelete();
    } else if (info.offset.x > 150 && onArchive) {
      onArchive();
    }
    x.set(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background Actions */}
      <motion.div
        style={{ background }}
        className="absolute inset-0 flex items-center justify-between px-6"
      >
        <Archive className="h-5 w-5 text-white" />
        <Trash2 className="h-5 w-5 text-white" />
      </motion.div>

      {/* Swipeable Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}
```

#### 4.3 Touch-Friendly Forms
**Updates to Config Page:**
- Larger input fields (min-height: 44px)
- Bigger touch targets for buttons
- Spacing between form elements
- Number inputs with +/- buttons for mobile

---

## 📋 Implementation Checklist

### Week 1: Foundation ✅
- [ ] Install framer-motion, hamburger-react, react-use
- [ ] Create breakpoint system
- [ ] Build MobileNav component
- [ ] Update DashboardShell for responsive layout
- [ ] Test on mobile devices (iOS Safari, Android Chrome)

### Week 2: Components ✅
- [ ] Make Overview page responsive
- [ ] Create ResponsiveTable component
- [ ] Update Messages page for mobile
- [ ] Update Users page for mobile
- [ ] Update Logs page for mobile
- [ ] Update Config page for mobile
- [ ] Test all pages on tablet

### Week 3: Animations ✅
- [ ] Add PageTransition wrapper
- [ ] Create skeleton loading states
- [ ] Build AnimatedCard component
- [ ] Create LoadingButton component
- [ ] Add StaggerList for animated lists
- [ ] Update all pages to use new components

### Week 4: Touch Features ✅
- [ ] Implement pull-to-refresh
- [ ] Add swipe actions to lists
- [ ] Optimize forms for touch
- [ ] Add haptic feedback (where supported)
- [ ] Test gestures on real devices

---

## 🎨 Design Tokens for Responsive

### Spacing Scale (Mobile-First)
```typescript
export const spacing = {
  mobile: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
  },
  desktop: {
    xs: '0.75rem',  // 12px
    sm: '1rem',     // 16px
    md: '1.5rem',   // 24px
    lg: '2rem',     // 32px
    xl: '3rem',     // 48px
  },
};
```

### Typography Scale (Fluid)
```typescript
export const typography = {
  h1: 'text-2xl md:text-3xl lg:text-4xl',
  h2: 'text-xl md:text-2xl lg:text-3xl',
  h3: 'text-lg md:text-xl lg:text-2xl',
  body: 'text-sm md:text-base',
  small: 'text-xs md:text-sm',
};
```

### Touch Targets
```typescript
export const touchTargets = {
  minimum: '44px',    // iOS minimum
  comfortable: '48px', // Android recommended
  large: '56px',      // For primary actions
};
```

---

## 🧪 Testing Strategy

### Devices to Test
1. **Mobile**
   - iPhone 14 Pro (iOS 17) - Safari
   - Samsung Galaxy S23 (Android 14) - Chrome
   - iPhone SE (small screen)

2. **Tablet**
   - iPad Pro 12.9" - Safari
   - Samsung Galaxy Tab S8 - Chrome

3. **Desktop**
   - 1920x1080 (Full HD)
   - 1366x768 (Laptop)
   - 2560x1440 (2K)

### Test Scenarios
- [ ] Navigation works on all screen sizes
- [ ] Tables are readable on mobile
- [ ] Forms are usable with touch
- [ ] Animations don't cause jank
- [ ] Loading states show correctly
- [ ] Pull-to-refresh works smoothly
- [ ] Swipe gestures feel natural
- [ ] Text is readable without zooming
- [ ] Buttons are easy to tap
- [ ] No horizontal scrolling

---

## 📊 Performance Targets

### Mobile Performance
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Cumulative Layout Shift: < 0.1
- Largest Contentful Paint: < 2.5s

### Animation Performance
- 60 FPS on all animations
- No layout thrashing
- GPU-accelerated transforms
- Reduced motion support

---

## 🚀 Quick Wins (Do First)

1. **Add Mobile Navigation** (2 hours)
   - Hamburger menu with Framer Motion
   - Immediate mobile usability

2. **Responsive Grid System** (1 hour)
   - Update all `grid` to responsive
   - Cards stack on mobile

3. **Touch-Friendly Buttons** (30 min)
   - Increase button sizes to 44px+
   - Add more padding

4. **Loading Skeletons** (2 hours)
   - Replace loading spinners
   - Better perceived performance

5. **Page Transitions** (1 hour)
   - Smooth fade animations
   - Professional feel

---

## 📝 Code Standards

### Mobile-First CSS
```typescript
// ✅ Good - Mobile first
className="text-sm md:text-base lg:text-lg"

// ❌ Bad - Desktop first
className="text-lg md:text-base sm:text-sm"
```

### Touch Targets
```typescript
// ✅ Good - 44px minimum
className="min-h-[44px] min-w-[44px] p-3"

// ❌ Bad - Too small
className="h-8 w-8 p-1"
```

### Responsive Spacing
```typescript
// ✅ Good - Scales with screen
className="p-4 md:p-6 lg:p-8"

// ❌ Bad - Fixed spacing
className="p-6"
```

---

## 🎯 Success Metrics

### User Experience
- Mobile bounce rate < 30%
- Average session duration > 3 minutes
- Task completion rate > 85%

### Technical
- Lighthouse mobile score > 90
- Core Web Vitals all green
- Zero accessibility violations

### Business
- Mobile usage increases by 40%
- Support tickets decrease by 25%
- User satisfaction score > 4.5/5

---

## 📚 Resources

### Documentation
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [React Use Hooks](https://github.com/streamich/react-use)
- [Hamburger React](https://hamburger-react.netlify.app/)

### Best Practices
- [Mobile-First Design Rules](https://lobehub.com/skills/oimiragieo-agent-studio-mobile-first-design-rules)
- [Touch Target Sizes](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Responsive Images](https://web.dev/responsive-images/)

---

## 🔄 Maintenance Plan

### Monthly
- Test on latest iOS/Android versions
- Update dependencies
- Review analytics for mobile issues
- Optimize images

### Quarterly
- Accessibility audit
- Performance review
- User feedback session
- A/B test new features

---

**Total Estimated Time:** 4 weeks (160 hours)  
**Priority:** High  
**Impact:** Transformative - enables mobile users

**Next Steps:**
1. Review and approve plan
2. Install dependencies
3. Start with Week 1 foundation
4. Test continuously on real devices
