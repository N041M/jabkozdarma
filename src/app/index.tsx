import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ContextCard, { type CardBar, type CardRight } from '@/components/context-card';
import { CameraControls, ScaleBadge, StreakPill } from '@/components/map-chrome';
import { PlacementBar, PlacementCrosshair } from '@/components/placement';
import Rail, { type RailAction } from '@/components/rail';
import TreeMap from '@/components/tree-map';
import { ripenessColors, useTheme } from '@/constants/theme';
import { CARD_GAP, RAIL_GAP, useBottomChrome } from '@/lib/chrome';
import { clusterTrees, walkMinutes } from '@/lib/clustering';
import { streakFrom } from '@/lib/dex';
import { formatKm, monthShort, t as t2 } from '@/lib/i18n';
import { distanceMeters } from '@/lib/geo';
import {
  latestReport,
  pinRejectionLabel,
  ripenessLabels,
  treeTitle,
} from '@/lib/labels';
import { capturePhoto } from '@/lib/photo';
import { fetchWalkingRoute, formatWalkTime } from '@/lib/routing';
import { useStore } from '@/lib/store';
import { useToast } from '@/lib/toast';
import { VERIFY, isInServiceArea, placementDistance } from '@/lib/verification';
import type { LatLng } from '@/lib/routing';
import type { Tree } from '@/lib/types';
import { PICK_RADIUS_M, STOPS, clampStop, type ZoomStop } from '@/lib/zoom-ladder';
import { PRAGUE } from '@/components/tree-map.types';

const DUPLICATE_RADIUS_M = 25;
/** Three 40 px buttons and the two hairlines between them. */
const CAMERA_CONTROLS_H = 122;
/** How close to the picker counts as "the camera is already on you", as a
 *  fraction of what the current rung shows. */
const CENTRED_FRACTION = 0.08;
/** Fallback until the rail reports its measured height. */
const RAIL_H_GUESS = 349;

export default function MapScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chrome = useBottomChrome();

  const trees = useStore((s) => s.trees);
  const reports = useStore((s) => s.reports);
  const profile = useStore((s) => s.profile);
  const activeRoute = useStore((s) => s.activeRoute);
  const clearRoute = useStore((s) => s.clearRoute);
  const setRoute = useStore((s) => s.setRoute);
  const mapMode = useStore((s) => s.mapMode);
  const stop = useStore((s) => s.zoomStop);
  const setZoomStop = useStore((s) => s.setZoomStop);
  const railSide = useStore((s) => s.railSide);
  const setPendingPhoto = useStore((s) => s.setPendingPhoto);
  const lastRejection = useStore((s) => s.lastRejection);
  const clearRejection = useStore((s) => s.clearRejection);
  const activeDays = useStore((s) => s.activeDays);
  const addReport = useStore((s) => s.addReport);
  const showToast = useToast((s) => s.show);

  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null);
  /**
   * True while a pin is being aimed. The crosshair is the centre of the map,
   * so this changes what the whole screen is for: the card becomes a readout
   * of what is under it, and the rail's verb becomes "place".
   */
  const [placing, setPlacing] = useState(false);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  /**
   * How good the last fix was, in metres. Evidence that travels with a pin
   * and with a confirmation — see `src/lib/verification.ts`.
   */
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [railHeight, setRailHeight] = useState(RAIL_H_GUESS);
  const [districtName, setDistrictName] = useState<string | null>(null);
  const [mapCentre, setMapCentre] = useState<LatLng>(PRAGUE);
  const [livePitch, setLivePitch] = useState<number | undefined>(undefined);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  // Read by the stop-change effect, which must not re-run on every fix.
  const userLocRef = useRef<LatLng | null>(null);
  // Read by the same effect, and a ref rather than a dependency: dropping to
  // body scale re-centres, but *leaving* placement must not, and a dependency
  // would fire it on the way out and throw away the aim.
  const placingRef = useRef(false);

  /** Follow the player's position so the avatar keeps up as they walk. */
  const startWatching = useCallback(async () => {
    if (watchRef.current) return true;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 5000 },
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            setUserLoc({ lat: latitude, lng: longitude });
            setAccuracyM(Number.isFinite(accuracy) ? accuracy : null);
          }
        }
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    startWatching();
    return () => {
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [startWatching]);

  useEffect(() => {
    userLocRef.current = userLoc;
  }, [userLoc]);

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

  /**
   * Put the picker on screen the first time we learn where they are. Without
   * this the camera sits wherever it was left and the body-scale stop looks
   * at nothing in particular — the context card would say a tree is 12 m away
   * while the map showed a different neighbourhood.
   */
  const centredRef = useRef(false);
  useEffect(() => {
    if (!userLoc || centredRef.current) return;
    centredRef.current = true;
    setFlyTo({ ...userLoc, key: Date.now() });
  }, [userLoc]);

  // Dropping to body scale re-centres too: at 50 m the whole premise is that
  // you are the middle of the picture. Higher stops are about regions, so
  // they keep whatever the picker panned to.
  useEffect(() => {
    if (stop !== 0 || placingRef.current) return;
    const here = userLocRef.current;
    if (here) setFlyTo({ ...here, key: Date.now() });
  }, [stop]);

  // Also drop any tree with invalid coordinates — bad persisted data must
  // degrade to a missing pin, never a crashed map.
  const visibleTrees = useMemo(
    () =>
      trees.filter(
        (tree) =>
          tree.status !== 'gone' && Number.isFinite(tree.lat) && Number.isFinite(tree.lng)
      ),
    [trees]
  );

  /**
   * Distances the picker would actually walk start from the picker. Until
   * there is a fix, the camera is the best guess available.
   */
  const walkFrom = userLoc ?? mapCentre;

  /** What the camera is looking at — the question the context card answers. */
  const nearby = useMemo(() => {
    const radius = STOPS[stop].visibleWidthM / 2;
    return visibleTrees.filter(
      (tree) => distanceMeters(mapCentre.lat, mapCentre.lng, tree.lat, tree.lng) <= radius
    );
  }, [visibleTrees, mapCentre.lat, mapCentre.lng, stop]);

  /** The tree to pick from or walk to — nearest to the picker, not the camera. */
  const { nearest, nearestDistance } = useMemo(() => {
    let best: Tree | null = null;
    let bestD = Infinity;
    for (const tree of visibleTrees) {
      const d = distanceMeters(walkFrom.lat, walkFrom.lng, tree.lat, tree.lng);
      if (d < bestD) {
        bestD = d;
        best = tree;
      }
    }
    return { nearest: best, nearestDistance: bestD };
  }, [visibleTrees, walkFrom.lat, walkFrom.lng]);

  /** The tree the 50 m stop is standing at, if there is one. */
  const treeAtHand = userLoc && nearest && nearestDistance <= PICK_RADIUS_M ? nearest : null;

  const clusters = useMemo(
    () => clusterTrees(visibleTrees, reports, STOPS[2].clusterM ?? 400),
    [visibleTrees, reports]
  );

  /** The group worth flying to: the biggest one holding ripe fruit. */
  const bestCluster = useMemo(() => {
    const ripe = clusters.filter((c) => c.hasRipe);
    const pool = ripe.length ? ripe : clusters;
    return pool.sort((a, b) => b.count - a.count)[0] ?? null;
  }, [clusters]);

  // Only the district stop needs a neighbourhood name, and only for the one
  // group it is offering to fly to.
  const placeQuery = useMemo(
    () => (stop === 2 && bestCluster ? { lat: bestCluster.lat, lng: bestCluster.lng } : null),
    [stop, bestCluster]
  );
  const handlePlaceName = useCallback((name: string | null) => setDistrictName(name), []);

  /** Whether the camera is already sitting on the picker. */
  const centredOnUser = useMemo(() => {
    if (!userLoc) return false;
    const drift = distanceMeters(mapCentre.lat, mapCentre.lng, userLoc.lat, userLoc.lng);
    return drift <= STOPS[stop].visibleWidthM * CENTRED_FRACTION;
  }, [userLoc, mapCentre.lat, mapCentre.lng, stop]);

  const streak = useMemo(() => streakFrom(activeDays), [activeDays]);

  const counts = useMemo(() => {
    let ripe = 0;
    let unripe = 0;
    let none = 0;
    for (const tree of nearby) {
      const state = latestReport(tree.id, reports)?.state;
      if (state === 'ripe') ripe += 1;
      else if (state === 'unripe' || state === 'flowering') unripe += 1;
      else if (!state) none += 1;
    }
    return { ripe, unripe, none };
  }, [nearby, reports]);

  const ripeTotal = useMemo(
    () => visibleTrees.filter((tree) => latestReport(tree.id, reports)?.state === 'ripe').length,
    [visibleTrees, reports]
  );

  const seasonBars = useMemo(() => sixMonthBars(reports), [reports]);

  /**
   * What the crosshair is over, while a pin is being aimed.
   *
   * Recomputed as the map moves rather than when it stops, which is the whole
   * point of it: the readout has to describe the spot the finger is dragging
   * over now, not the one it last let go of. It also does the refusing —
   * a rule the picker can see coming while they aim is worth more than the
   * same rule as a red banner after the form.
   */
  const aim = useMemo(() => {
    if (!placing) return null;
    const pin = mapCentre;
    const distanceM = placementDistance(pin, userLoc, accuracyM);
    const duplicates = visibleTrees.filter(
      (tree) => distanceMeters(pin.lat, pin.lng, tree.lat, tree.lng) < DUPLICATE_RADIUS_M
    ).length;
    const outOfArea = !isInServiceArea(pin.lat, pin.lng);
    const tooFar = distanceM !== null && distanceM > VERIFY.maxPlacementM;

    const title =
      distanceM === null
        ? t2('placeNoFix')
        : distanceM < 3
          ? t2('placeAtYou')
          : t2('placeFrom', { n: Math.round(distanceM) });

    // One line, so it says the most urgent true thing: what would refuse the
    // pin, then what would make it a duplicate, then how well it is aimed.
    const subtitle = outOfArea
      ? t2('pin_out_of_area')
      : tooFar
        ? t2('placeTooFar', { m: VERIFY.maxPlacementM })
        : duplicates > 0
          ? t2('placeDuplicate', { count: duplicates, r: DUPLICATE_RADIUS_M })
          : !userLoc
            ? t2('placeNoFixSub')
            : // A fix exists but is too vague to place its owner anywhere, so
              // `placementDistance` threw it away and the pin is hand-aimed.
              distanceM === null
              ? t2('placeVagueFix', { n: Math.round(accuracyM ?? 0) })
              : accuracyM === null
                ? t2('placeDragHint')
                : t2('placeAccuracy', { n: Math.round(accuracyM) });

    return { pin, distanceM, duplicates, title, subtitle, blocked: outOfArea || tooFar };
  }, [placing, mapCentre, userLoc, accuracyM, visibleTrees]);

  // ---- actions -----------------------------------------------------------

  const requireProfile = () => {
    if (profile) return true;
    showToast(t2('toastSignIn'), 'person-circle');
    router.push('/profile');
    return false;
  };

  /**
   * A pin the database refused has already been rolled back out of the map
   * by the store; saying which rule stopped it is the part only a screen can
   * do. Derived rather than copied into state — a rejection is already state
   * somewhere, and mirroring it into an effect only invites the two to drift.
   */
  const banner = notice ?? (lastRejection ? pinRejectionLabel(lastRejection) : null);

  const dismissBanner = () => {
    setNotice(null);
    clearRejection();
  };

  /**
   * Ask for a fix once, on demand — the watcher only runs once granted.
   * Returns the fix's radius with it: `setAccuracyM` won't be visible to a
   * caller running in this same tick, so reading the state instead would
   * record no accuracy for the very first fix, which is the one that arrives
   * right after permission is granted.
   */
  const ensureLocation = async (): Promise<(LatLng & { accuracyM: number | null }) | null> => {
    if (userLoc) return { ...userLoc, accuracyM };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNotice(t2('noLocation'));
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!Number.isFinite(here.lat) || !Number.isFinite(here.lng)) return null;
      const fixAccuracy = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null;
      setUserLoc(here);
      setAccuracyM(fixAccuracy);
      startWatching();
      return { ...here, accuracyM: fixAccuracy };
    } catch {
      setNotice(t2('noLocation'));
      return null;
    }
  };

  /**
   * Go back to the picker. The camera is free to roam, so this is the way
   * home; it also doubles as the discoverable way to grant location, since
   * `ensureLocation` asks when there is no fix yet.
   */
  const locateMe = async () => {
    dismissBanner();
    const here = await ensureLocation();
    if (here) setFlyTo({ lat: here.lat, lng: here.lng, key: Date.now() });
  };

  /** Trhám — the check-in. Writes a ripe report for the tree you're at. */
  const checkIn = () => {
    if (!treeAtHand) {
      showToast(t2('toastNothingNear'), 'alert-circle');
      return;
    }
    if (!requireProfile()) return;
    const reward = addReport(treeAtHand.id, 'ripe', null, 'checkIn');
    if (!reward) return;
    if (reward.questCompleted) showToast(t2('toastQuest'), 'trophy');
    else showToast(t2('toastPick'), 'basket');
  };

  /**
   * Přidat — start aiming. The pin used to land on the device's own fix,
   * which welded three separate things together: where the tree is, where the
   * picker is, and whether they may contribute at all.
   *
   * They come apart here. The crosshair says where the tree is, and the
   * picker aims it against a map that shows the trunk; the fix becomes
   * evidence about the person placing it rather than the coordinate itself;
   * and having no fix stops being a refusal, because somebody standing in a
   * courtyard their phone can't see the sky from can still see the tree.
   */
  const startPlacing = async () => {
    if (!requireProfile()) return;
    dismissBanner();
    setPlacing(true);
    setZoomStop(0); // aiming needs the rung where a trunk is a trunk
    if (userLoc) {
      setFlyTo({ ...userLoc, key: Date.now() });
      return;
    }
    // No fix yet, so aim from wherever the camera already is — and ask, since
    // this is the moment the answer is worth something. The prompt is modal:
    // nothing is being dragged while it is up, so moving the camera onto the
    // answer can't be stealing an aim already under way.
    const here = await ensureLocation();
    if (here) setFlyTo({ lat: here.lat, lng: here.lng, key: Date.now() });
  };

  const cancelPlacing = () => setPlacing(false);

  /**
   * Umístit — commit the aim and open the form.
   *
   * The camera runs first and straight out of this tap. On web it is a file
   * input, and browsers only open one during a user gesture, so anything
   * awaited before it — a location read above all — spends the gesture and
   * the camera silently never opens. That constraint used to fight the pin,
   * because the fix had to be re-read *after* the photo to undo the metres
   * the photographer had stepped back; now the pin is already placed, and
   * nothing that happens during the photo can move it.
   *
   * Everything recorded here is what the readout was showing at the moment of
   * the tap, closed over before the await. A pin should carry the evidence
   * its author was shown, not whatever the watcher reported while they were
   * framing a photograph.
   */
  const placePin = async () => {
    if (!aim || aim.blocked) return;
    const { pin, distanceM, duplicates } = aim;
    const fix = accuracyM;

    const photo = await capturePhoto();
    setPendingPhoto(photo);
    setPlacing(false);
    router.push({
      pathname: '/add-tree',
      params: {
        lat: String(pin.lat),
        lng: String(pin.lng),
        nearby: String(duplicates),
        accuracy: fix === null ? '' : String(Math.round(fix)),
        placed: distanceM === null ? '' : String(Math.round(distanceM)),
      },
    });
  };

  /** Trasa — a walking route to the nearest tree. */
  const routeToNearest = async () => {
    if (!nearest) return;
    const here = await ensureLocation();
    if (!here) return;
    try {
      const result = await fetchWalkingRoute(here, { lat: nearest.lat, lng: nearest.lng });
      setRoute({ treeId: nearest.id, treeLabel: treeTitle(nearest), ...result });
      showToast(
        t2('toastRoute', { name: treeTitle(nearest), d: formatKm(result.distanceM / 1000) }),
        'walk'
      );
    } catch {
      showToast(t2('toastNoRoute'), 'alert-circle');
    }
  };

  /** Čtvrť — fly to the densest ripe group and drop to street scale. */
  const flyToDistrict = () => {
    if (!bestCluster) return;
    setFlyTo({ lat: bestCluster.lat, lng: bestCluster.lng, key: Date.now() });
    setZoomStop(1);
    showToast(
      districtName ? t2('toastDistrict', { name: districtName }) : t2('toastArea'),
      'navigate'
    );
  };

  /** Oblast — drop onto the densest region at district scale. */
  const flyToArea = () => {
    if (bestCluster) setFlyTo({ lat: bestCluster.lat, lng: bestCluster.lng, key: Date.now() });
    setZoomStop(2);
    showToast(t2('toastArea'), 'layers');
  };

  /**
   * Move along the ladder. Reads the live stop rather than this render's
   * copy, so tapping the badge three times quickly walks three rungs instead
   * of computing the same next rung three times.
   */
  const stepStop = (delta: number, wrap: boolean) => {
    const current = useStore.getState().zoomStop;
    setZoomStop(wrap ? (((current + delta + 4) % 4) as ZoomStop) : clampStop(current + delta));
  };

  // ---- the rail's bottom slot -------------------------------------------

  const action: RailAction = useMemo(() => {
    // Aiming takes the slot over entirely: while the crosshair is up there is
    // exactly one thing to do with the map, and it is under the thumb.
    if (aim) {
      return {
        key: 'place',
        icon: 'pin',
        label: t2('actPlace'),
        color: aim.blocked ? t.disabled : '#C9402F',
        onPress: placePin,
      };
    }
    switch (stop) {
      case 0:
        return treeAtHand
          ? { key: 'pick', icon: 'basket', label: t2('actPick'), color: '#C9402F', onPress: checkIn }
          : {
              key: 'add',
              icon: 'add',
              label: t2('actAdd'),
              color: '#C9402F',
              onPress: startPlacing,
            };
      case 1:
        return {
          key: 'route',
          icon: 'walk',
          label: t2('actRoute'),
          color: t.green,
          onPress: routeToNearest,
        };
      case 2:
        return {
          key: 'district',
          icon: 'navigate',
          label: t2('actDistrict'),
          color: t.green,
          onPress: flyToDistrict,
        };
      default:
        return {
          key: 'area',
          icon: 'layers',
          label: t2('actArea'),
          color: t.green,
          onPress: flyToArea,
        };
    }
    // The handlers close over fresh state on every render; the key is what
    // the rail actually watches for its label flash.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop, treeAtHand, t.green, t.disabled, districtName, nearest, bestCluster, userLoc, profile, aim]);

  // ---- the context card --------------------------------------------------

  const card = useMemo(() => {
    if (stop === 0) {
      if (!treeAtHand) {
        return {
          dotColor: null,
          title: t2('cardNoTree', { r: PICK_RADIUS_M }),
          subtitle: t2('cardNoTreeSub'),
          right: { kind: 'none' } as CardRight,
          onPress: undefined,
        };
      }
      const latest = latestReport(treeAtHand.id, reports);
      return {
        dotColor: ripenessColors[latest?.state ?? 'none'],
        title: treeTitle(treeAtHand),
        subtitle: `${latest ? ripenessLabels[latest.state] : t2('noReports')} · ${t2('metresAway', {
          n: Math.round(nearestDistance),
        })}`,
        // A tree nobody has reported on is the one the map most needs, so
        // it asks for that instead of a plain chevron.
        right: (latest
          ? { kind: 'chevron', direction: 'forward' }
          : { kind: 'report', label: t2('cardReport') }) as CardRight,
        onPress: () => router.push(`/tree/${treeAtHand.id}`),
      };
    }

    if (stop === 1) {
      return {
        dotColor: null,
        title: t2('cardInView', { n: nearby.length }),
        subtitle: t2('cardBreak', counts),
        right: { kind: 'chevron', direction: 'up' } as CardRight,
        onPress: () => router.push('/harvest'),
      };
    }

    if (stop === 2) {
      // Without a fix, the only reference point is the camera — which is
      // sitting on the cluster — so a distance here would read "0,0 km".
      const d =
        userLoc && bestCluster
          ? distanceMeters(userLoc.lat, userLoc.lng, bestCluster.lat, bestCluster.lng)
          : null;
      const n = bestCluster?.count ?? 0;
      return {
        dotColor: bestCluster?.hasRipe ? ripenessColors.ripe : null,
        // The basemap can only name a neighbourhood it has actually drawn, so
        // an off-screen cluster stays unnamed rather than borrowing the region.
        title: districtName ? t2('cardBest', { name: districtName }) : t2('cardBestNearby'),
        subtitle:
          d === null
            ? t2('cardBestSubNoLocation', { n })
            : t2('cardBestSub', {
                n,
                d: formatKm(d / 1000),
                t: formatWalkTime(walkMinutes(d)),
              }),
        right: { kind: 'chevron', direction: 'forward' } as CardRight,
        onPress: flyToDistrict,
      };
    }

    return {
      dotColor: null,
      title: t2('cardRegion'),
      subtitle: t2('cardRegionSub', { n: visibleTrees.length, r: ripeTotal }),
      right: { kind: 'chart', bars: seasonBars } as CardRight,
      onPress: undefined,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stop,
    treeAtHand,
    nearestDistance,
    nearby.length,
    counts,
    bestCluster,
    districtName,
    userLoc,
    visibleTrees.length,
    ripeTotal,
    seasonBars,
    reports,
    walkFrom.lat,
    walkFrom.lng,
  ]);

  const railBottom = chrome + RAIL_GAP;
  const chromeTop = insets.top + 8;

  return (
    <View style={{ flex: 1 }}>
      <TreeMap
        trees={visibleTrees}
        reports={reports}
        onPressTree={(tree) => router.push(`/tree/${tree.id}`)}
        flyTo={flyTo}
        route={activeRoute}
        userLocation={userLoc}
        mode={mapMode}
        stop={stop}
        onStopChange={setZoomStop}
        onPressCluster={(center) => {
          setFlyTo({ ...center, key: Date.now() });
          setZoomStop(1);
        }}
        placeQuery={placeQuery}
        onPlaceName={handlePlaceName}
        onCenterChange={setMapCentre}
        trackCenter={placing}
        overhead={placing}
        onPitchChange={setLivePitch}
      />

      {aim && <PlacementCrosshair blocked={aim.blocked} />}

      <ScaleBadge stop={stop} top={chromeTop} pitch={livePitch} onPress={() => stepStop(1, true)} />
      <StreakPill streak={streak} top={chromeTop} onPress={() => router.push('/dex')} />

      {stop === 3 && <DensityLegend top={chromeTop + 42} />}

      {activeRoute && (
        <View style={[styles.banner, { top: chromeTop + 42, backgroundColor: t.surface }]}>
          <Ionicons name="walk" size={20} color={t.green} />
          <Text style={{ color: t.ink, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {t2('routeTo', { label: activeRoute.treeLabel })}
          </Text>
          <Pressable
            onPress={clearRoute}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t2('dismiss')}>
            <Ionicons name="close" size={22} color={t.muted} />
          </Pressable>
        </View>
      )}

      {banner && (
        <View style={[styles.banner, { top: chromeTop + 42, backgroundColor: t.surface }]}>
          <Text style={{ color: t.red, fontSize: 13, flex: 1 }}>{banner}</Text>
          <Pressable
            onPress={dismissBanner}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t2('dismiss')}>
            <Ionicons name="close" size={20} color={t.muted} />
          </Pressable>
        </View>
      )}

      <CameraControls
        stop={stop}
        side={railSide}
        onLocate={locateMe}
        centred={centredOnUser}
        bottom={railBottom + railHeight - CAMERA_CONTROLS_H}
        onStep={(delta) => stepStop(delta, false)}
      />

      <Rail side={railSide} bottom={railBottom} action={action} onHeight={setRailHeight} />

      {/* Same corner, same geometry, different question: while a pin is being
          aimed the bottom edge reports what is under the crosshair instead of
          what the camera is looking at. */}
      {aim ? (
        <PlacementBar
          title={aim.title}
          subtitle={aim.subtitle}
          blocked={aim.blocked}
          onCancel={cancelPlacing}
          left={12}
          bottom={chrome + CARD_GAP}
        />
      ) : (
        <ContextCard
          dotColor={card.dotColor}
          title={card.title}
          subtitle={card.subtitle}
          right={card.right}
          onPress={card.onPress}
          left={12}
          bottom={chrome + CARD_GAP}
        />
      )}
    </View>
  );
}

/** How many ripe reports each of the last six months carried. */
function sixMonthBars(reports: { state: string; createdAt: string }[]): CardBar[] {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth(), count: 0 };
  });
  for (const report of reports) {
    if (report.state !== 'ripe') continue;
    const d = new Date(report.createdAt);
    const slot = months.find((m) => m.year === d.getFullYear() && m.month === d.getMonth());
    if (slot) slot.count += 1;
  }
  const peak = Math.max(1, ...months.map((m) => m.count));
  return months.map((m, i) => ({
    label: monthShort(m.month + 1),
    value: m.count / peak,
    current: i === months.length - 1,
  }));
}

/** The swatch scale that makes the density fill readable. */
function DensityLegend({ top }: { top: number }) {
  const t = useTheme();
  return (
    <View style={[styles.legend, { top, backgroundColor: t.surface }]}>
      <Text style={[styles.legendTitle, { color: t.muted }]}>{t2('densityLegend')}</Text>
      <View style={styles.legendRow}>
        <Text style={[styles.legendEnd, { color: t.muted }]}>1</Text>
        {[0.2, 0.4, 0.6, 0.8, 1].map((alpha) => (
          <View
            key={alpha}
            style={[styles.swatch, { backgroundColor: `rgba(56,117,74,${alpha})` }]}
          />
        ))}
        <Text style={[styles.legendEnd, { color: t.muted }]}>20+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legend: {
    position: 'absolute',
    right: 12,
    padding: 10,
    borderRadius: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legendTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendEnd: { fontSize: 10 },
  swatch: { width: 15, height: 11, borderRadius: 2 },
});
