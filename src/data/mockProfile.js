// Placeholder data. Swap this out for your real API / database later.
export const mockProfile = {
  id: 'u_001',
  name: 'Matias Antunes',
  username: 'matias',
  headline: 'Long-term investor · Tech & Energy',
  bio: 'Building Agora 📈 — where investors share ideas, not hype. Fundamentals over FOMO.',
  location: 'Lisbon, PT',
  website: 'agora.app',
  avatar: 'https://i.pravatar.cc/300?img=12',
  followers: 1284,
  following: 312,
};

// Made-up numbers for the prototype
export const mockPortfolio = {
  totalValue: 48250.0,
  holdings: [
    {
      ticker: 'META',
      name: 'Meta Platforms',
      weight: 0.5,
      returns: { '1M': 5.8, '6M': 4.6, '1Y': 31.2, '5Y': 142.7 },
    },
    {
      ticker: 'ENB',
      name: 'Enbridge Inc.',
      weight: 0.5,
      returns: { '1M': 1.1, '6M': -8.4, '1Y': 6.3, '5Y': 49.9 },
    },
  ],
  benchmark: {
    name: 'S&P 500',
    returns: { '1M': 2.2, '6M': 5.1, '1Y': 14.8, '5Y': 88.4 },
  },
};

export const mockPosts = Array.from({ length: 12 }, (_, i) => ({
  id: `p_${i + 1}`,
  image: `https://picsum.photos/seed/agora-${i + 1}/600/600`,
  likes: Math.floor(Math.random() * 900) + 20,
  comments: Math.floor(Math.random() * 80),
}));

export const mockThoughts = [
  {
    id: 't_1',
    text: 'Added to $META on the dip. Ad revenue growth + Reality Labs losses narrowing = margin expansion story for 2027.',
    sentiment: 'bullish',
    time: '2h',
    likes: 148,
    replies: 26,
  },
  {
    id: 't_2',
    text: '$ENB is my sleep-well-at-night position. ~7% yield, regulated pipelines, 29 straight years of dividend hikes.',
    sentiment: 'bullish',
    time: '1d',
    likes: 92,
    replies: 14,
  },
  {
    id: 't_3',
    text: 'Rate cuts are priced in. If CPI surprises hot, utilities and $ENB take the hit first. Trimming nothing, but watching.',
    sentiment: 'bearish',
    time: '3d',
    likes: 61,
    replies: 33,
  },
];
