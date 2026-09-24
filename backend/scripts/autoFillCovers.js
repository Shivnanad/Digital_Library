const fs = require("fs");
const path = require("path");

const coversFile = path.join(__dirname, "../seed/googleCovers.json");
const covers = JSON.parse(fs.readFileSync(coversFile, "utf8"));

// Auto-generated cover URLs
const urlMap = {
  "The Subtle Art of Not Giving a F*ck": "https://m.media-amazon.com/images/I/71QKQ9mwV7L._SL1500_.jpg",
  "Deep Work": "https://m.media-amazon.com/images/I/71p6TF5XwQL._SL1500_.jpg",
  "Start With Why": "https://m.media-amazon.com/images/I/710OqXiLp2L._SL1500_.jpg",
  "The Psychology of Money": "https://m.media-amazon.com/images/I/71OK8kKI4VL._SL1500_.jpg",
  "Can't Hurt Me": "https://m.media-amazon.com/images/I/71TAIVx80BL._SL1500_.jpg",
  "The Alchemist": "https://m.media-amazon.com/images/I/71aFt4+OTOL._SL1500_.jpg",
  "Ikigai": "https://m.media-amazon.com/images/I/71eVvOBYGnL._SL1500_.jpg",
  "Grit": "https://m.media-amazon.com/images/I/710MhqKzpIL._SL1500_.jpg",
  "Mindset": "https://m.media-amazon.com/images/I/81sSMa0jZyL._SL1500_.jpg",
  "Awaken the Giant Within": "https://m.media-amazon.com/images/I/71iiS7JZLXL._SL1500_.jpg",
  "The Four Agreements": "https://m.media-amazon.com/images/I/71sKkrBccRL._SL1500_.jpg",
  "Meditations": "https://m.media-amazon.com/images/I/71r4c50-02L._SL1500_.jpg",
  "The Art of War": "https://m.media-amazon.com/images/I/51uYWAqKcRL._SL1500_.jpg",
  "The 48 Laws of Power": "https://m.media-amazon.com/images/I/71nY7kQZmoL._SL1500_.jpg",
  "The Power of Habit": "https://m.media-amazon.com/images/I/81leU97bHNL._SL1500_.jpg",
  "Think Like a Monk": "https://m.media-amazon.com/images/I/71RHMY3YSOL._SL1500_.jpg",
  "Ego Is the Enemy": "https://m.media-amazon.com/images/I/71nfHFkTc5L._SL1500_.jpg",
  "Do Epic Shit": "https://m.media-amazon.com/images/I/71DTLR+GXIL._SL1500_.jpg",
  "Who Will Cry When You Die": "https://m.media-amazon.com/images/I/71P4wWWYqpL._SL1500_.jpg",
  "The Monk Who Sold His Ferrari": "https://m.media-amazon.com/images/I/71wZQfcG6pL._SL1500_.jpg",
  "The Intelligent Investor": "https://m.media-amazon.com/images/I/71vHIZvJiEL._SL1500_.jpg",
  "Zero to One": "https://m.media-amazon.com/images/I/81K06CqJbAL._SL1500_.jpg",
  "Outliers": "https://m.media-amazon.com/images/I/81gk+h3CRTL._SL1500_.jpg",
  "Sapiens": "https://m.media-amazon.com/images/I/71VquYIjX1L._SL1500_.jpg",
  "Homo Deus": "https://m.media-amazon.com/images/I/71ib8vT1U0L._SL1500_.jpg",
  "The Courage to Be Disliked": "https://m.media-amazon.com/images/I/81IzX2OM3YL._SL1500_.jpg",
  "The Compound Effect": "https://m.media-amazon.com/images/I/715K9MqIR1L._SL1500_.jpg",
  "Rework": "https://m.media-amazon.com/images/I/51KDmBKkkgL._SL1500_.jpg",
  "Make Your Bed": "https://m.media-amazon.com/images/I/71KRRBqNDqL._SL1500_.jpg",
  "As a Man Thinketh": "https://m.media-amazon.com/images/I/71dLqPXxe-L._SL1500_.jpg",
  "The Secret": "https://m.media-amazon.com/images/I/71sKkrBccRL._SL1500_.jpg",
  "Limitless": "https://m.media-amazon.com/images/I/81hCZLSQq9L._SL1500_.jpg",
  "Tools of Titans": "https://m.media-amazon.com/images/I/71K7L5VeZBL._SL1500_.jpg",
  "The One Thing": "https://m.media-amazon.com/images/I/81qNcH-EqzL._SL1500_.jpg",
  "Drive": "https://m.media-amazon.com/images/I/71+qfUiVKXL._SL1500_.jpg",
  "Steal Like an Artist": "https://m.media-amazon.com/images/I/711VFvT+qQL._SL1500_.jpg",
  "The Richest Man in Babylon": "https://m.media-amazon.com/images/I/81jQVdDjBUL._SL1500_.jpg",
  "A Brief History of Time": "https://m.media-amazon.com/images/I/51xymjPVVxL._SL1500_.jpg",
  "Educated": "https://m.media-amazon.com/images/I/81WB7x2bJxL._SL1500_.jpg",
  "The Magic of Thinking Big": "https://m.media-amazon.com/images/I/71nrCrLWxSL._SL1500_.jpg",
  "The Alchemist's Companion": "https://m.media-amazon.com/images/I/71IF3o-1WbL._SL1500_.jpg",
  "Start Now Get Perfect Later": "https://m.media-amazon.com/images/I/71F8tIb5ooL._SL1500_.jpg",
  "Life's Amazing Secrets": "https://m.media-amazon.com/images/I/71IhRc+JKTL._SL1500_.jpg",
  "You Can Win": "https://m.media-amazon.com/images/I/71sAY2LvFRL._SL1500_.jpg",
  "The Power of Positive Thinking": "https://m.media-amazon.com/images/I/71R-0QdC0tL._SL1500_.jpg",
  "The Mountain Is You": "https://m.media-amazon.com/images/I/71fC3TvlOLL._SL1500_.jpg",
  "Think Straight": "https://m.media-amazon.com/images/I/71owN9LN+4L._SL1500_.jpg",
  "Atomic Focus": "https://m.media-amazon.com/images/I/71din4TLubL._SL1500_.jpg",
  "Psychology of Success": "https://m.media-amazon.com/images/I/71y-ggbYfmL._SL1500_.jpg",
  "The Law of Attraction": "https://m.media-amazon.com/images/I/71IiFcLdFOL._SL1500_.jpg",
  "Unfuck Yourself": "https://m.media-amazon.com/images/I/71HVu5Yd45L._SL1500_.jpg",
  "The Comfort Crisis": "https://m.media-amazon.com/images/I/81VRnfqKF7L._SL1500_.jpg",
  "The Obstacle Is the Way": "https://m.media-amazon.com/images/I/71j-21SXPOL._SL1500_.jpg",
  "Stillness Is the Key": "https://m.media-amazon.com/images/I/718FI-6E7pL._SL1500_.jpg",
  "Essentialism": "https://m.media-amazon.com/images/I/71t+4g9O2+L._SL1500_.jpg",
  "The Miracle Morning": "https://m.media-amazon.com/images/I/81YkqyaFVEL._SL1500_.jpg",
  "Eat That Frog": "https://m.media-amazon.com/images/I/71O8c4Rk2TL._SL1500_.jpg",
  "The Success Principles": "https://m.media-amazon.com/images/I/81+7RfM2W7L._SL1500_.jpg",
  "The Art of Thinking Clearly": "https://m.media-amazon.com/images/I/71Y6Ugh+QDL._SL1500_.jpg",
  "The Courage to Be Happy": "https://m.media-amazon.com/images/I/81kI7zH4MZL._SL1500_.jpg",
  "Flow": "https://m.media-amazon.com/images/I/81TpJxIb1CL._SL1500_.jpg",
  "Mastery": "https://m.media-amazon.com/images/I/71d9MLEevKL._SL1500_.jpg",
  "The Almanack of Naval Ravikant": "https://m.media-amazon.com/images/I/81QW8-CDBVL._SL1500_.jpg",
  "The Personal MBA": "https://m.media-amazon.com/images/I/814mGhfBvKL._SL1500_.jpg",
  "Think Faster Talk Smarter": "https://m.media-amazon.com/images/I/71EsVKHqgYL._SL1500_.jpg",
  "The Happiness Advantage": "https://m.media-amazon.com/images/I/714nqDCdvxL._SL1500_.jpg",
  "The Daily Stoic": "https://m.media-amazon.com/images/I/71pNfpUUCzL._SL1500_.jpg",
  "Mindset Secrets for Winning": "https://m.media-amazon.com/images/I/71lYZcIhNYL._SL1500_.jpg",
  "The 5 AM Club": "https://m.media-amazon.com/images/I/81pDDv3XwfL._SL1500_.jpg",
  "Life Is What You Make It": "https://m.media-amazon.com/images/I/71ZdGnC5YlL._SL1500_.jpg",
  "Rewire Your Brain": "https://m.media-amazon.com/images/I/71WLnBYvPcL._SL1500_.jpg",
  "The Book of Joy": "https://m.media-amazon.com/images/I/71NJ7rZ7iQL._SL1500_.jpg"
};

// Fill in missing URLs
let updated = 0;
Object.keys(covers).forEach(id => {
  const title = covers[id].title;
  if (covers[id].coverUrl.includes("PASTE_YOUR")) {
    covers[id].coverUrl = urlMap[title] || "https://via.placeholder.com/300x400?text=No+Cover";
    updated++;
  }
});

fs.writeFileSync(coversFile, JSON.stringify(covers, null, 2));
console.log(`✅ Added URLs to ${updated} remaining books!`);
