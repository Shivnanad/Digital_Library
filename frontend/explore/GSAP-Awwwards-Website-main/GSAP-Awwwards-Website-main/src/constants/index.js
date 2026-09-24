const VIDEO_VERSION = "20260316-2";

const flavorlists = [
  {
    name: "New Releases",
    color: "brown",
    rotation: "md:rotate-[-8deg] rotate-0",
  },
  {
    name: "Award Winners",
    color: "red",
    rotation: "md:rotate-[8deg] rotate-0",
  },
  {
    name: "Mystery and Crime",
    color: "blue",
    rotation: "md:rotate-[-8deg] rotate-0",
  },
  {
    name: "Sci-Fi and Fantasy",
    color: "orange",
    rotation: "md:rotate-[8deg] rotate-0",
  },
  {
    name: "Student Essentials",
    color: "white",
    rotation: "md:rotate-[-8deg] rotate-0",
  },
  {
    name: "Audiobook Picks",
    color: "black",
    rotation: "md:rotate-[8deg] rotate-0",
  },
];

const nutrientLists = [
  { label: "Digital Titles", amount: "245K" },
  { label: "Audiobooks", amount: "50K" },
  { label: "Active Readers", amount: "176K" },
  { label: "Daily Borrows", amount: "5K" },
  { label: "Partner Libraries", amount: "120" },
];

const cards = [
  {
    src: `/videos/f1.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[-10deg]",
    name: "Ariana",
    img: "/images/p1.png",
    translation: "translate-y-[-5%]",
  },
  {
    src: `/videos/f2.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[4deg]",
    name: "Liam",
    img: "/images/p2.png",
  },
  {
    src: `/videos/f3.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[-4deg]",
    name: "Sophia",
    img: "/images/p3.png",
    translation: "translate-y-[-5%]",
  },
  {
    src: `/videos/f4.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[4deg]",
    name: "Noah",
    img: "/images/p4.png",
    translation: "translate-y-[5%]",
  },
  {
    src: `/videos/f5.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[-10deg]",
    name: "Mia",
    img: "/images/p5.png",
  },
  {
    src: `/videos/f6.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[4deg]",
    name: "Ethan",
    img: "/images/p6.png",
    translation: "translate-y-[5%]",
  },
  {
    src: `/videos/f7.mp4?v=${VIDEO_VERSION}`,
    rotation: "rotate-z-[-3deg]",
    name: "Isabella",
    img: "/images/p7.png",
    translation: "translate-y-[10%]",
  },
];

export { flavorlists, nutrientLists, cards };
