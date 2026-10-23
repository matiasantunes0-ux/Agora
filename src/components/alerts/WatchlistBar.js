import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../../theme';

export default function WatchlistBar({ watchlist, max, onAdd, onRemove }) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const full = watchlist.length >= max;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    const err = await onAdd(text);
    setBusy(false);
    if (err) {
      setError(err);
    } else {
      setText('');
      setError(null);
      setAdding(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <Text style={styles.count}>{watchlist.length}/{max}</Text>
      </View>

      <View style={styles.chips}>
        {watchlist.map((t) => (
          <View key={t} style={styles.chip}>
            <Text style={styles.chipText}>{t}</Text>
            <Pressable onPress={() => onRemove(t)} hitSlop={10} accessibilityLabel={`Remove ${t}`}>
              <Ionicons name="close" size={14} color={colors.primary} />
            </Pressable>
          </View>
        ))}
        {!full && !adding && (
          <Pressable style={[styles.chip, styles.addChip]} onPress={() => setAdding(true)} accessibilityLabel="Add ticker">
            <Ionicons name="add" size={15} color={colors.onPrimary} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        )}
      </View>

      {adding && (
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={(v) => { setText(v); setError(null); }}
            placeholder="Ticker, e.g. AAPL or STN.TO"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            keyboardAppearance="dark"
            returnKeyType="done"
            onSubmitEditing={submit}
            style={styles.input}
            maxLength={12}
          />
          <Pressable onPress={submit} style={styles.inputBtn} disabled={busy}>
            {busy ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Text style={styles.inputBtnText}>Add</Text>}
          </Pressable>
          <Pressable onPress={() => { setAdding(false); setText(''); setError(null); }} hitSlop={8}>
            <Ionicons name="close-circle" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      {watchlist.length === 0 && !adding && (
        <Text style={styles.hint}>Add up to {max} stocks. You’ll only hear about news that could move them.</Text>
      )}
      {full && <Text style={styles.hint}>Watchlist full. Remove a stock to add another.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
  },
  addChip: {
    backgroundColor: colors.primary,
    gap: 3,
  },
  addText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputBtn: {
    height: 40,
    minWidth: 56,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.loss,
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
  },
});
