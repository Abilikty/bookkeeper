import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SYMBOLS = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥', HKD: 'HK$', KRW: '₩' };

function getMyShare(expense) {
  return expense.splits?.find(s => s.person === '我')?.share_amount || expense.amount || 0;
}

const CATEGORY_CONFIG = {
  '餐饮': { icon: 'fast-food', color: '#F59E0B', bg: '#FFFBEB' },
  '交通': { icon: 'car', color: '#3B82F6', bg: '#EFF6FF' },
  '购物': { icon: 'cart', color: '#10B981', bg: '#ECFDF5' },
  '娱乐': { icon: 'game-controller', color: '#8B5CF6', bg: '#F5F3FF' },
  '居住': { icon: 'home', color: '#EF4444', bg: '#FEF2F2' },
  '其他': { icon: 'wallet', color: '#6B7280', bg: '#F9FAFB' },
};

export default function ExpenseCard({ expense, onPress, onLongPress }) {
  const { item, amount, category, split_type, splits, created_at } = expense;
  const myShare = getMyShare(expense);
  const sym = SYMBOLS[expense.currency] || '¥';
  const cat = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['其他'];

  const date = created_at ? new Date(created_at) : new Date();
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const splitLabel = split_type === 'single' ? '单人' : `${splits?.length || 0}人AA`;
  const isMulti = splits?.length > 1;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.6}>
      <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon} size={22} color={cat.color} />
      </View>
      <View style={styles.info}>
        <Text style={styles.item} numberOfLines={1}>{item}</Text>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={12} color="#9CA3AF" />
          <Text style={styles.date}> {dateStr} {timeStr}</Text>
          <View style={[styles.tag, { backgroundColor: cat.bg }]}>
            <Text style={[styles.tagText, { color: cat.color }]}>{splitLabel}</Text>
          </View>
        </View>
      </View>
      <View style={styles.amountCol}>
        {isMulti ? (
          <>
            <Text style={styles.myShare}>{sym}{myShare.toFixed(2)}</Text>
            <Text style={styles.totalAmount}>/ {sym}{amount.toFixed(2)}</Text>
          </>
        ) : (
          <Text style={styles.myShare}>{sym}{amount.toFixed(2)}</Text>
        )}
        <Text style={[styles.category, { color: cat.color }]}>{category}</Text>
        {expense.original_currency && expense.original_amount && (
          <Text style={styles.original}>原 {expense.original_currency} {expense.original_amount}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 5,
    padding: 16, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  info: { flex: 1, marginRight: 10 },
  item: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 5 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 12, color: '#9CA3AF' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  tagText: { fontSize: 11, fontWeight: '600' },
  amountCol: { alignItems: 'flex-end' },
  myShare: { fontSize: 17, fontWeight: '700', color: '#1F2937' },
  totalAmount: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  category: { fontSize: 11, fontWeight: '500', marginTop: 3 },
  original: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
});
