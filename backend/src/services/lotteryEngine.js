const crypto = require('crypto');

class LotteryEngine {
  /**
   * Generates a single ticket of 5 distinct numbers between 1 and 99 using secure cryptographic randomness.
   * Can optionally exclude a set or array of already taken numbers so all players at the table have distinct lucky numbers.
   * Also verifies against existing tickets to ensure at least one number is different between any two players.
   * @param {Set<number>|number[]} excluded Numbers to exclude from selection
   * @param {number[][]} existingTickets Existing player tickets at the table
   */
  static generateTicket(excluded = [], existingTickets = []) {
    const excludedSet = excluded instanceof Set ? excluded : new Set(Array.isArray(excluded) ? excluded : []);
    const available = [];
    for (let i = 1; i <= 99; i++) {
      if (!excludedSet.has(i)) {
        available.push(i);
      }
    }

    // When there are at least 5 available numbers, pick 5 cryptographically distinct numbers
    if (available.length >= 5) {
      const numbers = new Set();
      while (numbers.size < 5) {
        const randomIndex = crypto.randomInt(0, available.length);
        numbers.add(available[randomIndex]);
      }
      return Array.from(numbers).sort((a, b) => a - b);
    }

    // Fallback: pick 5 distinct numbers from 1 to 99, ensuring ticket is not identical to any existing player
    let attempts = 0;
    while (attempts < 100) {
      attempts++;
      const numbers = new Set();
      while (numbers.size < 5) {
        numbers.add(crypto.randomInt(1, 100));
      }
      const ticket = Array.from(numbers).sort((a, b) => a - b);
      const ticketStr = ticket.join(',');
      const isDuplicate = existingTickets.some(
        t => Array.isArray(t) && t.slice().sort((a, b) => a - b).join(',') === ticketStr
      );
      if (!isDuplicate) {
        return ticket;
      }
    }

    const numbers = new Set();
    while (numbers.size < 5) {
      numbers.add(crypto.randomInt(1, 100));
    }
    return Array.from(numbers).sort((a, b) => a - b);
  }

  /**
   * Generates unique 5-digit number sets for players, ensuring no overlapping lucky numbers among players.
   * For 10 players, this generates 10 distinct tickets containing 50 completely unique lucky numbers.
   * @param {number} count Number of tickets to generate (defaults to 10)
   */
  static generateTicketsForTable(count = 10) {
    const available = [];
    for (let i = 1; i <= 99; i++) available.push(i);

    // Cryptographic Fisher-Yates shuffle
    for (let i = available.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [available[i], available[j]] = [available[j], available[i]];
    }

    const tickets = [];
    for (let t = 0; t < count; t++) {
      if ((t + 1) * 5 <= available.length) {
        const ticket = available.slice(t * 5, (t + 1) * 5).sort((a, b) => a - b);
        tickets.push(ticket);
      } else {
        tickets.push(this.generateTicket());
      }
    }

    return tickets;
  }

  /**
   * Generates a random pool of numbers from 1 to 99, guaranteeing to include ALL players' lucky numbers
   * plus 20 additional random numbers from 1 to 99.
   * 
   * The total number of balls drawn depends dynamically on the number of players:
   * - Each player has 5 unique lucky numbers.
   * - 2 players -> 10 lucky numbers + 20 random numbers = 30 balls total.
   * - 10 players -> 50 lucky numbers + 20 random numbers = 70 balls total.
   * 
   * @param {Array<{ numbers: number[] }>} players Seated players with their lucky numbers
   * @param {number} additionalRandomCount Number of additional random numbers to include (default 20)
   * @returns {number[]} Cryptographically shuffled array of numbers from 1 to 99
   */
  static generateDrawPool(players = [], additionalRandomCount = 20) {
    const luckyNumbersSet = new Set();
    for (const player of players) {
      if (Array.isArray(player?.numbers)) {
        for (const num of player.numbers) {
          const n = Number(num);
          if (n >= 1 && n <= 99) {
            luckyNumbersSet.add(n);
          }
        }
      }
    }

    const luckyNumbers = Array.from(luckyNumbersSet);

    // Collect all numbers from 1 to 99 that are NOT any player's lucky number
    const remainingAvailable = [];
    for (let i = 1; i <= 99; i++) {
      if (!luckyNumbersSet.has(i)) {
        remainingAvailable.push(i);
      }
    }

    // Cryptographically shuffle the remaining non-lucky numbers
    for (let i = remainingAvailable.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [remainingAvailable[i], remainingAvailable[j]] = [remainingAvailable[j], remainingAvailable[i]];
    }

    // Take exactly 20 additional random numbers from remaining available numbers
    const extraCount = Math.max(0, Math.min(additionalRandomCount, remainingAvailable.length));
    const additionalNumbers = remainingAvailable.slice(0, extraCount);

    // Combine all players' lucky numbers + the additional numbers
    const pool = [...luckyNumbers, ...additionalNumbers];

    // Cryptographically shuffle the combined pool for the draw sequence
    for (let i = pool.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool;
  }

  /**
   * Draws a cryptographically secure random ball from remaining pool (fallback)
   * @param {number[]} drawnBalls List of balls already drawn in this round
   */
  static drawNextBall(drawnBalls = []) {
    const drawnSet = new Set(drawnBalls);
    const available = [];
    for (let i = 1; i <= 99; i++) {
      if (!drawnSet.has(i)) {
        available.push(i);
      }
    }

    if (available.length === 0) {
      throw new Error('All 99 balls have been drawn');
    }

    const randomIndex = crypto.randomInt(0, available.length);
    return available[randomIndex];
  }

  /**
   * Checks matches for each player and determines if any player has achieved 5 matches
   * @param {Array<{userId: string, seatNumber: number, numbers: number[], username: string}>} players
   * @param {number[]} drawnBalls
   * @returns {{ updatedPlayers: Array, winner: Object|null }}
   */
  static evaluateRound(players, drawnBalls) {
    const drawnSet = new Set(drawnBalls);
    const updatedPlayers = [];
    const eligibleWinners = [];

    for (const player of players) {
      const matched = (player.numbers || []).filter(n => drawnSet.has(n));
      const matchedCount = matched.length;

      const playerState = {
        ...player,
        matchedCount,
        matchedNumbers: matched,
        hasWon: matchedCount === 5,
      };

      updatedPlayers.push(playerState);

      if (matchedCount === 5) {
        eligibleWinners.push(playerState);
      }
    }

    let winner = null;
    if (eligibleWinners.length === 1) {
      winner = eligibleWinners[0];
    } else if (eligibleWinners.length > 1) {
      // Tie-breaker: player with lowest seat number
      winner = eligibleWinners.sort((a, b) => a.seatNumber - b.seatNumber)[0];
    }

    return {
      updatedPlayers,
      winner,
    };
  }

  /**
   * Computes payout and platform fees
   * @param {number} entryFee Entry fee per player
   * @param {number} playerCount Number of players (default 10)
   * @param {number} commissionPercent Platform commission % (default 10)
   */
  static calculatePayout(entryFee, playerCount = 10, commissionPercent = 10) {
    const totalPool = BigInt(entryFee) * BigInt(playerCount);
    const platformCommission = (totalPool * BigInt(commissionPercent)) / 100n;
    const winnerPayout = totalPool - platformCommission;

    return {
      totalPool: Number(totalPool),
      platformCommission: Number(platformCommission),
      winnerPayout: Number(winnerPayout),
    };
  }
}

module.exports = LotteryEngine;
