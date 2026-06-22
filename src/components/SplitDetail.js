import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SplitDetail({ splits, totalAmount, splitType }) {
  const labels = { equal: '均摊 AA', single: '单人支付', ratio: '按比例' };
  const sum = splits.reduce((s, i) => s + i.share_amount, 0);
  const valid = Math.abs(sum - totalAmount) < 0.02;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={20} color="#4F46E5" />
        <Text style={styles.title}> {labels[splitType] || splitType} · 总 ¥{totalAmount.toFixed(2)}</Text>
      </View>

      {splits.map((split, i) => (
        <View key={i} style={[styles.row, i < splits.length - 1 && styles.rowBorder]}>
          <View style={[styles.avatar, split.person === '我' && styles.avatarMe]}>
            <Text style={[styles.avatarText, split.person === '我' && styles.avatarTextMe]}>
              {split.person?.charAt(0) || '?'}
            </Text>
          </View>
          <Text style={[styles.name, split.person === '我' && styles.nameMe]}>
            {split.person}
          </Text>
          <Text style={styles.amount}>¥{split.share_amount.toFixed(2)}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Ionicons name={valid ? 'checkmark-circle' : 'alert-circle'} size={16} color={valid ? '#10B981' : '#EF4444'} />
        <Text style={[styles.footerText, { color: valid ? '#10B981' : '#EF4444' }]}>
          分摊合计 ¥{sum.toFixed(2)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginVertical: 8,
    borderWidth: 1, borderColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 14, fontWeight: '600', color: '#374151' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarMe: { backgroundColor: '#4F46E5' },
  avatarText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  avatarTextMe: { color: '#fff' },
  name: { flex: 1, fontSize: 15, color: '#374151' },
  nameMe: { fontWeight: '700', color: '#1F2937' },
  amount: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  footerText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
});
