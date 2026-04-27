import { Page, Locator, expect } from '@playwright/test';
import { navigateToGameTab } from '../utils/navigation';

/**
 * Page Object for Common Room Polls
 *
 * Handles poll creation, voting, and result viewing within the Common Room.
 * Polls are accessed via: Game → Common Room tab → Polls sub-tab
 */
export class PollsPage {
  readonly page: Page;
  readonly gameId: number;

  // Locators
  readonly createPollButton: Locator;
  readonly pollsList: Locator;

  constructor(page: Page, gameId: number) {
    this.page = page;
    this.gameId = gameId;

    // Define locators
    this.createPollButton = page.getByRole('button', { name: 'Create Poll' });
    this.pollsList = page.locator('[data-testid="polls-list"]');
  }

  /**
   * Navigate to game's polls section (Common Room → Polls)
   */
  async goto() {
    await this.page.goto(`/games/${this.gameId}`);
    await this.page.waitForLoadState('networkidle');

    // Navigate to Common Room tab (handles mobile select and desktop tabs)
    await navigateToGameTab(this.page, 'Common Room');

    // Click Polls sub-tab
    const pollsSubTab = this.page.getByRole('button', { name: /Polls/ });
    await expect(pollsSubTab).toBeVisible({ timeout: 5000 });
    await pollsSubTab.click();
    await this.page.waitForLoadState('networkidle');

    // Wait for polls content to actually load (not just network idle)
    // Wait for the main "Polls" heading (visible to all users)
    await expect(
      this.page.getByRole('heading', { name: /^Polls$/i, level: 3 })
    ).toBeVisible({ timeout: 5000 });
  }

  /**
   * Create a new poll
   *
   * @param options - Poll configuration
   */
  async createPoll(options: {
    question: string;
    description?: string;
    deadline?: Date;
    options: string[];
    allowOther?: boolean;
    showIndividualVotes?: boolean;
  }) {
    await this.createPollButton.click();

    // Wait for modal
    await expect(this.page.getByRole('heading', { name: 'Create New Poll', level: 4 })).toBeVisible();

    // Fill basic info
    await this.page.getByPlaceholder('What would you like to ask?').fill(options.question);
    if (options.description) {
      await this.page.getByPlaceholder('Provide additional context or instructions...').fill(options.description);
    }

    // Set deadline if provided
    if (options.deadline) {
      // Find the deadline input by its placeholder text (react-datepicker renders a regular input)
      // We need to scroll to it first as it may be below the fold in the modal
      const deadlineInput = this.page.getByPlaceholder('Select date and time');

      // Scroll to the deadline input to make it visible
      await deadlineInput.scrollIntoViewIfNeeded();

      // Click to open the calendar popup
      await deadlineInput.click();
      // Wait for calendar to appear by checking for the month heading
      await this.page.waitForSelector('.react-datepicker', { timeout: 5000 });

      // Calculate which date to click in the calendar
      const day = options.deadline.getDate();
      const month = options.deadline.toLocaleString('default', { month: 'long' });
      const year = options.deadline.getFullYear();
      const dayOfWeek = options.deadline.toLocaleString('default', { weekday: 'long' });

      // Click the date cell in the calendar
      // Use ordinal suffix for date (1st, 2nd, 3rd, 4th, etc.)
      const getOrdinalSuffix = (n: number) => {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
      };
      const ordinalDay = `${day}${getOrdinalSuffix(day)}`;
      const dateLabel = `Choose ${dayOfWeek}, ${month} ${ordinalDay}, ${year}`;

      await this.page.getByRole('gridcell', { name: new RegExp(dateLabel, 'i') }).click();

      // Select time from the time listbox
      // Round minutes to nearest 15-minute interval (00, 15, 30, 45)
      const hours = options.deadline.getHours();
      const minutes = options.deadline.getMinutes();
      const roundedMinutes = Math.round(minutes / 15) * 15;

      // Handle hour overflow if rounding causes minutes to be 60
      const finalHours = roundedMinutes === 60 ? hours + 1 : hours;
      const finalMinutes = roundedMinutes === 60 ? 0 : roundedMinutes;

      const hoursString = String(finalHours).padStart(2, '0');
      const minutesString = String(finalMinutes).padStart(2, '0');
      const timeString = `${hoursString}:${minutesString}`;

      await this.page.getByRole('option', { name: timeString }).click();

      // Calendar closes automatically after time selection
      await expect(this.page.getByRole('dialog', { name: 'Choose Date and Time' })).not.toBeVisible({ timeout: 3000 });
    }

    // Add poll options
    for (let i = 0; i < options.options.length; i++) {
      // Add more option fields if needed (before filling)
      if (i >= 2) {
        await this.page.getByRole('button', { name: 'Add Option' }).click();
        // Wait for new option field to appear
        await this.page.locator(`input[placeholder="Option ${i + 1}"]`).waitFor({ timeout: 5000 });
      }

      const optionInput = this.page.locator(`input[placeholder="Option ${i + 1}"]`);
      await optionInput.fill(options.options[i]);
    }

    // Optional settings
    if (options.allowOther) {
      await this.page.locator('div:has(label:has-text("Allow \'Other\' text responses")) input[type="checkbox"]').last().check();
    }

    if (options.showIndividualVotes) {
      await this.page.locator('div:has(label:has-text("Show individual votes to all players")) input[type="checkbox"]').first().check();
    }

    // Submit poll
    await this.page.getByRole('button', { name: 'Create Poll', exact: true }).click();
    await this.page.waitForLoadState('networkidle');

    // Verify poll appears
    await expect(this.page.getByText(options.question)).toBeVisible({ timeout: 5000 });
  }

  /**
   * Vote on a poll by question text
   *
   * @param question - Poll question to vote on
   * @param response - Option text to vote for, or object for custom "Other" response
   */
  async voteOnPoll(question: string, response: string | { other: string }) {
    // Find the poll heading
    const pollHeading = this.page.getByRole('heading', { name: question });
    await expect(pollHeading).toBeVisible({ timeout: 10000 });

    // Find all Vote Now buttons and click the one near this poll
    // Use evaluate to find the correct button associated with this poll
    await this.page.evaluate((questionText) => {
      const headings = Array.from(document.querySelectorAll('h4'));
      const heading = headings.find(h => h.textContent?.includes(questionText));
      if (!heading) throw new Error(`Could not find poll heading: ${questionText}`);

      // Walk up to find the poll container
      let parent = heading.parentElement;
      while (parent && parent !== document.body) {
        const buttons = Array.from(parent.querySelectorAll('button'));
        const voteButton = buttons.find(btn => btn.textContent?.includes('Vote Now'));
        if (voteButton) {
          voteButton.click();
          return;
        }
        parent = parent.parentElement;
      }
      throw new Error(`Could not find Vote Now button for poll: ${questionText}`);
    }, question);

    // Wait for voting modal
    await expect(this.page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

    // Select response
    if (typeof response === 'string') {
      await this.page.getByRole('radio', { name: response }).check();
    } else {
      // Custom "Other" response
      await this.page.getByRole('radio', { name: 'Other (specify below)' }).check();
      await this.page.locator('input[placeholder="Enter your custom response..."]').fill(response.other);
    }

    // Submit vote
    await expect(this.page.getByRole('button', { name: 'Submit Vote' })).toBeEnabled();
    await this.page.getByRole('button', { name: 'Submit Vote' }).click();

    // Wait for modal to close
    await expect(this.page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Vote on a poll by index (useful when multiple polls exist)
   *
   * @param pollIndex - Zero-based index of poll (0 = first poll)
   * @param response - Option text to vote for, or object for custom "Other" response
   */
  async voteOnPollByIndex(pollIndex: number, response: string | { other: string }) {
    const voteButtons = this.page.getByRole('button', { name: 'Vote Now' });
    await voteButtons.nth(pollIndex).click();

    await expect(this.page.getByText('Select your response')).toBeVisible({ timeout: 5000 });

    if (typeof response === 'string') {
      await this.page.getByRole('radio', { name: response }).check();
    } else {
      await this.page.getByRole('radio', { name: 'Other (specify below)' }).check();
      await this.page.locator('input[placeholder="Enter your custom response..."]').fill(response.other);
    }

    await this.page.getByRole('button', { name: 'Submit Vote' }).click();
    await expect(this.page.getByText('Select your response')).not.toBeVisible({ timeout: 5000 });
  }

  /**
   * Check vote status badge for a poll
   *
   * @param question - Poll question
   * @returns 'voted' or 'not-voted'
   */
  async getPollVoteStatus(question: string): Promise<'voted' | 'not-voted'> {
    // Find the poll heading
    const pollHeading = this.page.getByRole('heading', { name: question });
    await expect(pollHeading).toBeVisible({ timeout: 5000 });

    // Use evaluate to check the badge text within the poll's container
    const status = await this.page.evaluate((questionText) => {
      const headings = Array.from(document.querySelectorAll('h4'));
      const heading = headings.find(h => h.textContent?.includes(questionText));
      if (!heading) return null;

      // Walk up to find container with badge
      let parent = heading.parentElement;
      while (parent && parent !== document.body) {
        const text = parent.textContent || '';
        if (text.includes('Not Voted')) return 'not-voted';
        if (text.includes('Voted') && !text.includes('Not Voted')) return 'voted';
        parent = parent.parentElement;
      }
      return null;
    }, question);

    if (status === 'voted') return 'voted';
    if (status === 'not-voted') return 'not-voted';
    throw new Error(`Could not determine vote status for poll: ${question}`);
  }

  /**
   * Get count of "Voted" badges (useful for verifying multiple votes)
   */
  async getVotedBadgeCount(): Promise<number> {
    const votedBadges = this.page.getByText('Voted');
    return await votedBadges.count();
  }

  /**
   * Show poll results (GM/Audience only)
   *
   * @param question - Poll question, or index number
   */
  async showResults(question: string | number) {
    if (typeof question === 'number') {
      const showButtons = this.page.getByRole('button', { name: 'Show Results' });
      await showButtons.nth(question).click();
    } else {
      await this.page.getByRole('button', { name: 'Show Results' }).first().click();
    }

    await expect(this.page.getByRole('heading', { name: 'Results' }).first()).toBeVisible();
  }

  /**
   * Hide poll results
   *
   * @param question - Poll question, or index number
   */
  async hideResults(question: string | number) {
    if (typeof question === 'number') {
      const hideButtons = this.page.getByRole('button', { name: 'Hide Results' });
      await hideButtons.nth(question).click();
    } else {
      await this.page.getByRole('button', { name: 'Hide Results' }).first().click();
    }

    await expect(this.page.getByRole('heading', { name: 'Results' }).first()).not.toBeVisible();
  }

  /**
   * Check if user can view results (GM/Audience only for active polls)
   */
  async canViewResults(): Promise<boolean> {
    const showButton = this.page.getByRole('button', { name: 'Show Results' }).first();
    const isVisible = await showButton.isVisible();
    return isVisible;
  }

  /**
   * Toggle expired polls filter
   */
  async toggleExpiredPolls() {
    const expiredToggle = this.page.locator('input[type="checkbox"][id="show-expired"]');
    await expiredToggle.check();
  }

  /**
   * Verify poll exists by question
   */
  async hasPoll(question: string): Promise<boolean> {
    try {
      await expect(this.page.getByText(question)).toBeVisible({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
