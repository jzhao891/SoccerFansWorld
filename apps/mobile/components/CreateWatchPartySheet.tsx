import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { collection, doc, setDoc } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';
import { db } from '../lib/firebase';
import { useMapStore, WORLD_CUP_2026_TEAMS } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.88;

function defaultKickoff() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function formatDateTime(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  defaultLocation?: { lat: number; lng: number };
  defaultSource?: 'google' | 'osm' | 'custom';
  defaultVenueId?: string | null;
}

export default function CreateWatchPartySheet({ visible, onClose, defaultLocation, defaultSource, defaultVenueId }: Props) {
  const bounds = useMapStore((s) => s.bounds);
  const viewState = useMapStore((s) => s.viewState);

  const mapCenter = defaultLocation ?? (bounds
    ? { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 }
    : { lat: viewState.latitude, lng: viewState.longitude });

  const [partyName, setPartyName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kickoff, setKickoff] = useState<Date>(defaultKickoff);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 14,
    }).start();
    if (!visible) {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }, [visible, translateY]);

  const meetingPoint = gpsLocation ?? mapCenter;
  const canSubmit = partyName.trim() && eventTitle.trim();

  function toggleTeam(team: string) {
    setSelectedTeams((prev) =>
      prev.includes(team) ? prev.filter((t) => t !== team) : [...prev, team],
    );
  }

  async function useGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setGpsLoading(false);
    }
  }

  function handleDateChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) {
      const next = new Date(kickoff);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setKickoff(next);
    }
  }

  function handleTimeChange(_: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selected) {
      const next = new Date(kickoff);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setKickoff(next);
    }
  }

  function resetAndClose() {
    setPartyName('');
    setEventTitle('');
    setDescription('');
    setKickoff(defaultKickoff());
    setSelectedTeams([]);
    setGpsLocation(null);
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const ref = doc(collection(db, 'venues'));
      await setDoc(ref, {
        source: defaultSource ?? 'custom',
        venue_id: defaultVenueId ?? null,
        name: partyName.trim(),
        event_title: eventTitle.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        location: meetingPoint,
        geohash: geohashForLocation([meetingPoint.lat, meetingPoint.lng]),
        start_time: kickoff.getTime(),
        watching_teams: selectedTeams,
        amenities: [],
        is_active: true,
        created_by: '',
        created_at: Date.now(),
      });
      resetAndClose();
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={resetAndClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        {/* Handle */}
        <TouchableOpacity onPress={resetAndClose} style={styles.handleRow}>
          <View style={styles.handle} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Host a watch party</Text>
          <TouchableOpacity onPress={resetAndClose} hitSlop={8}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Party name */}
          <Text style={styles.label}>Party name <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. WC Watch Party"
            placeholderTextColor={colors.textFaint}
            value={partyName}
            onChangeText={setPartyName}
            returnKeyType="next"
          />

          {/* Event title */}
          <Text style={styles.label}>What are you watching? <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. USA vs England — Group Stage"
            placeholderTextColor={colors.textFaint}
            value={eventTitle}
            onChangeText={setEventTitle}
            returnKeyType="next"
          />

          {/* Date & time */}
          <Text style={styles.label}>Date & time <Text style={styles.required}>*</Text></Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}>
              <Text style={styles.dateBtnText}>
                {kickoff.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}>
              <Text style={styles.dateBtnText}>
                {kickoff.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={kickoff}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={kickoff}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleTimeChange}
            />
          )}

          {/* Meeting point */}
          <Text style={styles.label}>Meeting point</Text>
          <View style={styles.locationRow}>
            <Text style={styles.locationText} numberOfLines={1}>
              {gpsLocation
                ? `GPS: ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
                : `Map center (${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})`}
            </Text>
            <TouchableOpacity style={styles.gpsBtn} onPress={useGPS} disabled={gpsLoading}>
              {gpsLoading
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : <Text style={styles.gpsBtnText}>Use GPS</Text>}
            </TouchableOpacity>
          </View>

          {/* Teams */}
          <Text style={styles.label}>
            Teams{selectedTeams.length > 0 ? ` (${selectedTeams.length})` : ''}
          </Text>
          <View style={styles.teamGrid}>
            {WORLD_CUP_2026_TEAMS.map((team) => {
              const active = selectedTeams.includes(team);
              return (
                <TouchableOpacity
                  key={team}
                  style={[styles.teamPill, active && styles.teamPillActive]}
                  onPress={() => toggleTeam(team)}
                >
                  <Text style={[styles.teamPillText, active && styles.teamPillTextActive]}>
                    {team}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={styles.label}>Description <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g. Meet here first, then we'll head somewhere together"
            placeholderTextColor={colors.textFaint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || saving) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Text style={styles.submitText}>Create watch party</Text>}
          </TouchableOpacity>

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    zIndex: 50,
    ...shadow.lg,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 17, fontWeight: '700', color: colors.black },
  closeBtn: { fontSize: 18, color: colors.textFaint },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  required: { color: '#F87171' },
  optional: { fontWeight: '400', textTransform: 'none', color: colors.textFaint },
  input: {
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  textArea: { minHeight: 80, paddingTop: 10 },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateBtn: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateBtnText: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  locationText: { flex: 1, fontSize: 13, color: colors.textMuted },
  gpsBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minWidth: 72,
    alignItems: 'center',
  },
  gpsBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  teamPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
  },
  teamPillActive: { backgroundColor: colors.black, borderColor: colors.black },
  teamPillText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  teamPillTextActive: { color: colors.white },
  submitBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.border },
  submitText: { fontSize: 15, fontWeight: '600', color: colors.white },
});
