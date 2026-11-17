import { CardTemplate, HourlyQuestType, Stats } from '@cardwar/shared';

export interface CharacterDTO {
  id: number;
  name: string;
  heroEmoji: string;
  level: number;
  xp: number;
  xpNext: number;
  statPoints: number;
  allocated: Partial<Stats>;
  gold: number;
  energy: number;
  energyAt: string;
  hp: number;
  mana: number;
  stam: number;
  rating: number;
  wins: number;
  losses: number;
  highestFloor: number;
  stats: Stats;
  equipment: { slot: string; instanceId: number; templateId: string; template: CardTemplate | null }[];
  deckCount: number;
}

export interface QuestDTO {
  id: number;
  type: HourlyQuestType;
  name: string;
  target: number;
  progress: number;
  rewardGold: number;
  rewardXp: number;
  rewardCard: string | null;
  status: string;
  cooldownUntil: string | null;
}

export interface MeResponse {
  user: { id: number; name: string; avatar: string | null; isAdmin: boolean };
  character: CharacterDTO | null;
  quests: QuestDTO[];
}

export interface InventoryCard {
  id: number;
  templateId: string;
  card: CardTemplate;
  status: 'INVENTORY' | 'IN_DECK' | 'EQUIPPED' | 'SHOP';
  slot: string | null;
  durability?: number | null;
}

export interface ShopListingDTO {
  id: number;
  price: number;
  sellerName: string;
  createdAt: string;
  templateId: string;
  card: CardTemplate;
}

export interface LeaderRow {
  name: string;
  level: number;
  rating: number;
  wins: number;
  losses: number;
  avatar: string | null;
}

export interface BattleStateMsg {
  battleId: string;
  you: 'a' | 'b';
  state: import('@cardwar/shared').BattleState;
  turnEndsAt: number;
  started: boolean;
}

export interface BattleRewardsMsg {
  gold?: number;
  xp?: number;
  cards?: string[];
  ratingDelta?: number;
  newRating?: number;
  character: CharacterDTO;
}

// ---------------------------------------------------------------- เฟส 2

export interface AuctionDTO {
  id: number;
  card: CardTemplate;
  serial: number;
  sellerName: string;
  startPrice: number;
  currentBid: number | null;
  currentBidderName: string | null;
  buyoutPrice: number | null;
  endsAt: string;
  isMine: boolean;
  imHighest: boolean;
}

export interface DirectSaleDTO {
  id: number;
  card: CardTemplate;
  serial: number;
  sellerName: string;
  targetName: string;
  price: number;
  expiresAt: string;
  isMine: boolean;
  isForMe: boolean;
}

export interface FriendInfoDTO {
  friendshipId: number;
  userId: number;
  name: string;
  level: number;
  rating: number;
}

export interface FriendsResponse {
  friends: FriendInfoDTO[];
  incoming: { friendshipId: number; name: string; level: number }[];
  outgoing: { friendshipId: number; name: string }[];
}

export interface InboxItemDTO {
  userId: number;
  name: string;
  lastText: string;
  lastAt: string;
  unread: number;
}

export interface ChatMsgDTO {
  id: number;
  fromMe: boolean;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface GuildMemberDTO {
  userId: number;
  userName: string;
  role: string;
  level: number;
}

export interface GuildDTO {
  id: number;
  name: string;
  emblem: string;
  description: string;
  leaderName: string;
  memberCount: number;
  myRole?: string;
  members?: GuildMemberDTO[];
}

export interface GuildChatDTO {
  id: number;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface PlayerQuestDTO {
  id: number;
  creatorName: string;
  isMine: boolean;
  wanted: CardTemplate;
  quantity: number;
  delivered: number;
  remaining: number;
  goldPerUnit: number;
  xpPerUnit: number;
  totalReward: number;
  status: string;
  createdAt: string;
}

export interface CatalogItemDTO {
  id: string;
  name: string;
  emoji: string;
  rarity: string;
  basePrice: number;
  group: string;
  category: string;
}
