# Changelog

What changed in each version of *Rae's Study Note*. Newest first.

---

## 1.4.0 — 2026-09-02

**Vietnamese interface**

The whole app now speaks Vietnamese as well: every page, every gloss, every
practice hint and the settings themselves. Pick *Tiếng Việt* under Settings →
Language, or just open the app on a phone set to Vietnamese.

- **Written for Vietnamese readers, not translated word for word.** Where the
  Chinese notes warn that Indonesian puts the owner *after* the thing
  (*buku saya*), the Vietnamese notes point out that this is exactly how
  Vietnamese works. The same goes for *kami / kita* (*chúng tôi / chúng ta*),
  words that start with *ng*, and the two readings of *e* (*ê* and *e*)
- **Example sentences follow the interface language.** In Vietnamese the
  learner comes from Vietnam: *Saya dari Vietnam.* — with its own audio
- Chinese, Japanese and English are unchanged

## 1.3.0 — 2026-08-27

**Chapter 1 grows to twenty pages**

The first meeting of the speaking class (*Kelas Berbicara*, Pertemuan 1) with
Mbak Novi covers the same ground as Bab 1, so it has been folded into Bab 1
rather than added as a separate chapter. Ten new pages, 78 new words:

- **The alphabet.** The handout gives the *sound* each letter makes inside a
  word. What it never gives is the *name* of the letter — which is what you
  actually need to spell your name, read out a room number, or follow a teacher
  spelling a word on the board. All 26 names are here, every one of them
  tappable
- **Vowels.** The five vowel letters, and a proper answer to the question the
  handout raises but does not settle: how to tell the two e's apart. There is a
  rule that covers most cases, and it is spelled out
- **Consonants.** The ones that go wrong — c, j, ny, ng and a trilled r — with
  syllable cards you can slow down, chain together and record yourself against.
  Two digraphs missing from the handout, **sy** and **kh**, have been added
- **Numbers 0 to 99.** Units, teens and tens, then how they combine, plus the
  se- rule behind sepuluh, sebelas, seratus and seribu. Phone numbers get their
  own card, because zero is read *kosong* there and *nol* everywhere else
- **Answering Apa kabar?** What people actually say, rather than the textbook
  answer
- **Introducing yourself, slot by slot.** Name, where you are from, age, job,
  hobby — each with example sentences, plus word sets for jobs and hobbies
- **Introducing someone else.** The same five slots with *dia* and *-nya*
- **Practice and the interview.** Gap-fills and the five interview questions,
  ready before you have to ask them in class

The pages are interleaved with the existing ones rather than tacked on the end:
letters and sounds come first, numbers sit before you need them to say your age,
and the practice pages follow the model texts.

**Number practice in Latihan**

- The *number / price* question type is now live: a number appears, you pick how
  it is read. It has been switched off ever since the app launched, because
  nothing had taught numbers yet
- The *what time is it* type stays hidden until the clock is taught

**Corrections to the handout**

- *Angka Belasan* is glossed there as "Dozen Numbers". Belasan means the teens,
  11 to 19; a dozen is *selusin*
- *Silahkan* is written as *Silakan* in standard spelling
- The consonant table is missing **sy** and **kh**

## 1.2.0 — 2026-08-27

**Anonymous usage stats on the website**

- The website version now records how the app is actually used, so lessons and
  drills can be improved based on where people get stuck rather than guesswork:
  which pages get read, how long they're read for, which words and questions get
  answered wrong, which wrong option was picked, and which words get tapped for
  audio again and again
- It also reports page errors and missing audio automatically, so problems get
  noticed without anyone having to report them
- No cookies, no names, no email addresses, no IP addresses. A random number
  stored on your device is used only to tell devices apart. The footer says the
  same thing in all three languages
- **The offline single file and the Android app collect nothing at all** — not a
  single byte leaves them. The collecting code is only ever added to the website
  build
- If anything about this fails — no network, an ad blocker, private browsing —
  the app carries on exactly as before

## 1.1.0 — 2026-08-26

**Remembers your progress**

- Remembers the last page you were on, down to the scroll position — reopen the app and you're right back where you left off
- If a practice session gets interrupted (you switch apps, lock the screen, the OS reclaims the page), reopening picks up where you stopped
- Tracks right/wrong answers for every word and question, and prioritizes what you got wrong last time
- The glossary now shows a small dot marking how well you know each word
- Settings shows how much has been recorded, with a button to clear it anytime
- All of this stays on your device — nothing is uploaded anywhere

**Lesson 2**

- All eight pages: what this chapter covers / things around you (20 words) /
  entering the classroom (dialogue) / classroom phrases / *ini* and *itu* /
  how to say "whose" / my / your / his-her / things Indonesians carry
- 75 vocabulary words; example sentences use only words already taught
- Covers several points the textbook doesn't, but that trip everyone up:
  using *ini* in the question and *itu* in the answer isn't a typo; the
  difference between *silakan* and *tolong*; how *-nya* can also mean
  "the one just mentioned"

**New drills**

- Lesson 2 grammar drills: "my / your / his-her" (*-ku* / *-mu* / *-nya*) and
  "this / that" (*ini* / *itu*)
- Picture matching: 20 classroom objects, practiced in both directions
  (picture to word and word to picture)
- A new answer format, "build the sentence": tap the words below into order
  instead of typing
- Every wrong option now explains why it's wrong; a correct answer also
  states the rule

**Fixes**

- The page used to advance before the audio finished playing on a correct
  answer — now it waits
- Difficulty now actually steps down after consecutive wrong answers (this
  was supposed to work before but never actually did)
- In the Japanese and English interfaces, the self-introduction sentence had
  the nationality hard-coded to the Chinese version — it now follows the
  interface language
- Lesson 1's vocabulary groupings now match the textbook ("welcome" had been
  filed under "farewell")
- The dialogue now includes sentence 20 from the textbook, with a note on
  the textbook's typo in that line
- Tables are now mobile-first — no more scrolling sideways to read them
- Multiple wording fixes in the Japanese interface (using あの人 to refer to
  people, consistent formality register, punctuation)
- Grammar and punctuation fixes in the English interface
- A practice session interrupted mid-way (switching apps, locking the
  screen, the OS reclaiming the page) no longer restarts from scratch
- The footer now reads like a proper notice, with the version number, a
  link to the changelog, and the last-updated date

---

## 1.0.0 — 2026-08-25

First public release.

- Lesson 1, *Perkenalan* (Introductions), complete: 10 pages
- A 72-word glossary, each word with an example sentence and audio
- Review mode: auto-generated questions in four types — recognize, listen,
  recall, fill-in-the-blank
- Situational drills: contextual responses and listening questions
- Trilingual interface (Chinese / Japanese / English)
- All Indonesian audio synthesized by ElevenLabs, tap any word to hear it
- Light and dark themes, five color schemes, four font-size steps
