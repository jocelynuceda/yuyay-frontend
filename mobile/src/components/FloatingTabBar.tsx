import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { TabNavigatorParamList } from '../types';

const tabs: Record<keyof TabNavigatorParamList, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  HomeTab: { icon: 'home', label: 'Inicio' },
  Notifications: { icon: 'notifications', label: 'Avisos' },
  Profile: { icon: 'person', label: 'Perfil' },
};

/**
 * Barra inferior flotante: la píldora de la pestaña activa se desliza entre pestañas, y también
 * se puede deslizar el dedo sobre la barra para cambiar de pestaña. A la derecha, el botón de agregar.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tabWidth, setTabWidth] = useState(0);
  const [pillX] = useState(() => new Animated.Value(0));
  const touchStartX = useRef(0);
  const tabsLeft = useRef(0);
  const tabsRef = useRef<React.ComponentRef<typeof View>>(null);

  // La píldora sigue a la pestaña activa
  useEffect(() => {
    Animated.spring(pillX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }, [pillX, state.index, tabWidth]);

  // Dentro del Inicio, la barra solo se muestra en la pantalla principal (no en detalle ni formularios)
  const current = state.routes[state.index];
  if (current.name === 'HomeTab' && (getFocusedRouteNameFromRoute(current) ?? 'Home') !== 'Home') return null;

  const count = state.routes.length;
  const indexAt = (pageX: number) =>
    Math.min(Math.max(Math.floor((pageX - tabsLeft.current) / Math.max(tabWidth, 1)), 0), count - 1);

  function goTo(index: number) {
    const route = state.routes[index];
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (index !== state.index && !event.defaultPrevented) navigation.navigate(route.name);
  }

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.bar}>
        <View
          ref={tabsRef}
          style={styles.tabs}
          onLayout={(e) => {
            setTabWidth(e.nativeEvent.layout.width / count);
            tabsRef.current?.measureInWindow((x) => {
              tabsLeft.current = x;
            });
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.nativeEvent.pageX;
          }}
          // Si el dedo se desplaza en horizontal, la barra toma el gesto (en vez del toque de una pestaña)
          onMoveShouldSetResponderCapture={(e) => Math.abs(e.nativeEvent.pageX - touchStartX.current) > 10}
          onResponderTerminationRequest={() => false}
          onResponderMove={(e) => {
            const x = e.nativeEvent.pageX - tabsLeft.current - tabWidth / 2;
            pillX.setValue(Math.min(Math.max(x, 0), tabWidth * (count - 1)));
          }}
          onResponderRelease={(e) => {
            const index = indexAt(e.nativeEvent.pageX);
            goTo(index);
            Animated.spring(pillX, {
              toValue: index * tabWidth,
              useNativeDriver: true,
              bounciness: 6,
            }).start();
          }}
        >
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.pill, { width: tabWidth, transform: [{ translateX: pillX }] }]}
            />
          ) : null}
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const tab = tabs[route.name as keyof TabNavigatorParamList];

            return (
              <Pressable
                key={route.key}
                onPress={() => goTo(index)}
                style={styles.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={tab.label}
              >
                <Ionicons
                  name={focused ? tab.icon : (`${tab.icon}-outline` as keyof typeof Ionicons.glyphMap)}
                  size={22}
                  color={focused ? colors.onTabPill : colors.muted}
                />
                {focused ? <Text style={styles.label}>{tab.label}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => navigation.navigate('HomeTab', { screen: 'NewSubject' })}
          style={({ pressed }) => [styles.add, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Agregar persona a cargo"
        >
          <Ionicons name="add" size={30} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  wrapper: {
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    padding: 8,
    gap: 4,
    ...shadow,
    shadowOpacity: 0.1,
  },
  tab: {
    flex: 1,
    height: 48,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabs: { flex: 1, flexDirection: 'row' },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: colors.tabPill,
  },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onTabPill },
  add: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
}));
