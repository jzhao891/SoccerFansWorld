import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMapStore, WORLD_CUP_2026_TEAMS } from '@sfw/shared';
import { colors, spacing, radius, shadow } from '../theme';

interface GeocodeSuggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

export default function MapTopBar() {
  const insets = useSafeAreaInsets();
  const selectedTeam = useMapStore((s) => s.selectedTeam);
  const setSelectedTeam = useMapStore((s) => s.setSelectedTeam);
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget);

  const [filterOpen, setFilterOpen] = useState(false);
  const [teamQuery, setTeamQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      setSearchOpen(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${MAPBOX_TOKEN}&types=place,neighborhood,address,locality&limit=5`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        setSuggestions(data.features ?? []);
        setSearchOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  function selectTeam(team: string | null) {
    setSelectedTeam(team);
    setFilterOpen(false);
    setTeamQuery('');
  }

  function selectSuggestion(s: GeocodeSuggestion) {
    setFlyToTarget({ lng: s.center[0], lat: s.center[1], zoom: 13 });
    setSearchQuery(s.place_name);
    setSearchOpen(false);
    setSuggestions([]);
  }

  const filteredTeams = teamQuery.trim()
    ? WORLD_CUP_2026_TEAMS.filter((t) => t.toLowerCase().includes(teamQuery.toLowerCase()))
    : WORLD_CUP_2026_TEAMS;

  return (
    <View style={[styles.container, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      {/* top row */}
      <View style={styles.row}>
        {/* filter pill */}
        <TouchableOpacity
          style={[styles.filterPill, selectedTeam ? styles.filterPillActive : null]}
          onPress={() => { setFilterOpen(true); setSearchOpen(false); }}
        >
          <Text style={[styles.filterPillText, selectedTeam ? styles.filterPillTextActive : null]}>
            {selectedTeam ?? 'All teams'}
          </Text>
          {selectedTeam && (
            <TouchableOpacity onPress={() => selectTeam(null)} hitSlop={8}>
              <Text style={styles.clearX}> ✕</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* search input */}
        <View style={styles.searchBox}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search location…"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); setFilterOpen(false); }}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchQuery(''); setSuggestions([]); setSearchOpen(false); }}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <Text style={styles.clearX}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* geocode suggestions */}
      {searchOpen && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s.id} style={styles.dropdownItem} onPress={() => selectSuggestion(s)}>
              <Text style={styles.dropdownItemText} numberOfLines={1}>{s.place_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* team filter modal */}
      <Modal visible={filterOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFilterOpen(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter by team</Text>
            <TouchableOpacity onPress={() => setFilterOpen(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.teamSearch}
            placeholder="Search team…"
            placeholderTextColor="#9CA3AF"
            value={teamQuery}
            onChangeText={setTeamQuery}
            autoFocus
            autoCorrect={false}
          />
          <FlatList
            data={teamQuery.trim() ? filteredTeams : ['__all__', ...filteredTeams]}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              if (item === '__all__') {
                return (
                  <TouchableOpacity style={styles.teamItem} onPress={() => selectTeam(null)}>
                    <Text style={[styles.teamItemText, selectedTeam === null && styles.teamItemSelected]}>
                      All venues
                    </Text>
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity style={styles.teamItem} onPress={() => selectTeam(item)}>
                  <Text style={[styles.teamItemText, selectedTeam === item && styles.teamItemSelected]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No teams found</Text>}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  filterPillActive: { backgroundColor: colors.black },
  filterPillText: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  filterPillTextActive: { color: colors.white },
  clearX: { fontSize: 11, color: colors.textFaint },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
  },
  clearBtn: { paddingLeft: spacing.sm },
  dropdown: {
    marginTop: 6,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...shadow.md,
  },
  dropdownItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgSubtle,
  },
  dropdownItemText: { fontSize: 13, color: colors.textSecondary },
  modalContainer: { flex: 1, backgroundColor: colors.white },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', color: colors.black },
  modalClose: { fontSize: 15, color: colors.pinGoogle, fontWeight: '500' },
  teamSearch: {
    margin: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
    color: colors.textPrimary,
  },
  teamItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  teamItemText: { fontSize: 14, color: colors.textSecondary },
  teamItemSelected: { fontWeight: '700', color: colors.black },
  emptyText: { padding: spacing.lg, color: colors.textFaint, fontSize: 13, textAlign: 'center' },
});
