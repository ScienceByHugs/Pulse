import { useState } from 'react';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme';

const sections = [
  {
    title: 'Tracking',
    links: [
      {
        label: 'Today',
        caption: 'Daily overview and quick logging',
        route: '/(tabs)',
        path: '/',
      },
      {
        label: 'Protocols',
        caption: 'Substances and schedules',
        route: '/(tabs)/protocol',
        path: '/protocol',
      },
      {
        label: 'Timeline',
        caption: 'Recorded history and cycles',
        route: '/(tabs)/log',
        path: '/log',
      },
      {
        label: 'Insights',
        caption: 'Activity and supply signals',
        route: '/(tabs)/insights',
        path: '/insights',
      },
    ],
  },
  {
    title: 'Connections',
    links: [
      {
        label: 'Calendar',
        caption: 'Private opt-in schedule sync',
        route: '/calendar',
        path: '/calendar',
      },
    ],
  },
  {
    title: 'Account',
    links: [
      {
        label: 'Account & Privacy',
        caption: 'Profile, security and your data',
        route: '/(tabs)/you',
        path: '/you',
      },
      {
        label: 'Legal & Privacy',
        caption: 'Policies and your data rights',
        route: '/legal',
        path: '/legal',
      },
      {
        label: 'About & Safety',
        caption: 'Tracking boundaries and privacy controls',
        route: '/about',
        path: '/about',
      },
    ],
  },
] as const;

export function PulseMenu() {
  const reduceMotion = useReduceMotion();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <View style={styles.brandRow}>
        <View
          accessibilityLabel="Science By Hugs Pulse"
          style={styles.wordmarkWrap}
        >
          <Text style={styles.wordmark}>
            pulse<Text style={styles.wordmarkDot}>.</Text>
          </Text>
          <Text style={styles.wordmarkByline}>by Science By Hugs</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Pulse navigation"
          accessibilityHint="Shows app sections and tools"
          onPress={() => setOpen(true)}
          style={styles.trigger}
        >
          <View style={styles.bar} />
          <View style={styles.bar} />
          <View style={styles.bar} />
        </Pressable>
      </View>
      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.scrim,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss navigation"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.panel}>
            <View style={styles.panelTop}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>Pulse</Text>
                <Text style={styles.panelSubtitle}>
                  Your tracking, in one place.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation"
                onPress={() => setOpen(false)}
                style={styles.close}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {sections.map((section) => (
                <View key={section.title} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.sectionRule} />
                  </View>
                  {section.links.map((entry) => {
                    const active =
                      pathname === entry.path ||
                      (entry.path === '/' &&
                        (pathname === '/index' || pathname === '/(tabs)'));
                    return (
                      <Pressable
                        key={entry.route}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={entry.label}
                        accessibilityHint={entry.caption}
                        onPress={() => {
                          setOpen(false);
                          if (!active) router.push(entry.route);
                        }}
                        style={[styles.item, active && styles.itemActive]}
                      >
                        <View
                          style={[
                            styles.itemMarker,
                            active && styles.itemMarkerActive,
                          ]}
                        />
                        <View style={styles.itemBody}>
                          <Text
                            style={[
                              styles.itemText,
                              active && styles.itemTextActive,
                            ]}
                          >
                            {entry.label}
                          </Text>
                          <Text style={styles.itemCaption}>
                            {entry.caption}
                          </Text>
                        </View>
                        <Text
                          style={[styles.arrow, active && styles.arrowActive]}
                        >
                          {active ? '●' : '↗'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wordmarkWrap: { justifyContent: 'center' },
  wordmark: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -1.4,
  },
  wordmarkDot: { color: colors.accent },
  wordmarkByline: {
    color: '#A9BDCD',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
    letterSpacing: 0.1,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 54,
    marginBottom: layout.sectionGap,
  },
  trigger: {
    minHeight: layout.minTapHeight,
    width: 46,
    borderWidth: 0,
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  bar: {
    width: 18,
    height: 2,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-start',
  },
  panel: {
    marginHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0B1727',
    flexShrink: 1,
    overflow: 'hidden',
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: layout.cardInset,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelHeading: { flex: 1, minWidth: 0 },
  panelTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.9,
    marginTop: 7,
  },
  panelSubtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 4,
  },
  close: {
    minHeight: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: colors.text, fontSize: 23 },
  scrollContent: {
    padding: layout.cardInset,
    paddingBottom: 26,
    gap: spacing.lg,
  },
  section: { gap: 7 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 3,
  },
  sectionTitle: {
    color: '#A9BDCD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  sectionRule: { flex: 1, height: 1, backgroundColor: colors.border },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 59,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: radius.md,
    gap: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  itemMarker: {
    width: 3,
    height: 26,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  itemMarkerActive: { backgroundColor: colors.accent },
  itemBody: { flex: 1, minWidth: 0, gap: 3 },
  itemText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  itemTextActive: { color: colors.accent },
  itemCaption: { color: '#A9BDCD', fontSize: 12, lineHeight: 18 },
  arrow: { color: colors.subtle, fontSize: 18, fontWeight: '700' },
  arrowActive: { color: colors.accent, fontSize: 10 },
});
