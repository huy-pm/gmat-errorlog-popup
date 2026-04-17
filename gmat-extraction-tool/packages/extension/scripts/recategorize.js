#!/usr/bin/env node
/**
 * recategorize.js
 *
 * Re-assigns the `category` field for questions in "mixed" batch files
 * (Advance CR, Others, Question Pack 1/2) using keyword matching on questionText.
 *
 * Valid categories: Assumption | Strengthen | Weaken | Evaluate | Boldface |
 *                   Complete Argument | Paradox | Flaw | Conclusion |
 *                   Evaluate Argument | Inference
 *
 * Questions that don't match any rule get category = "" and are printed
 * at the end for manual review.
 *
 * Usage:
 *   node recategorize.js <file1> [file2] ...
 *
 * Example:
 *   node recategorize.js ~/Downloads/GMAT-HERO/verbal/advance-cr-*.json
 */

const fs   = require('fs');
const path = require('path');

const VALID_CATEGORIES = [
    'Assumption',
    'Strengthen',
    'Weaken',
    'Evaluate',
    'Boldface',
    'Complete Argument',
    'Paradox',
    'Flaw',
    'Conclusion',
    'Evaluate Argument',
    'Inference',
];

// ─── Classification rules ──────────────────────────────────────────────────────
// Rules are checked IN ORDER — first match wins.
// Each rule: { category, test(questionText, passage) → bool }

const RULES = [
    // ── Boldface ──────────────────────────────────────────────────────────────
    {
        category: 'Boldface',
        test: (qt, p) =>
            /boldface|bold face|bold-face/i.test(qt) ||
            /\*\*[^*]+\*\*/.test(p), // markdown bold in passage
    },

    // ── Complete Argument ─────────────────────────────────────────────────────
    {
        category: 'Complete Argument',
        test: (qt) =>
            /most logically completes?/i.test(qt) ||
            /best completes? the/i.test(qt) ||
            /logically completes? the/i.test(qt) ||
            /____+/.test(qt),
    },

    // ── Assumption ────────────────────────────────────────────────────────────
    {
        category: 'Assumption',
        test: (qt) =>
            /\bassumption\b/i.test(qt) ||
            /\bassumes?\b/i.test(qt) ||
            /\bassumed\b/i.test(qt) ||
            /presuppos/i.test(qt) ||
            /relies on the assumption/i.test(qt) ||
            /based on the assumption/i.test(qt) ||
            /requires? the assumption/i.test(qt) ||
            /plan assumes?/i.test(qt) ||
            /argument assumes?/i.test(qt) ||
            /conclusion.*assumes?/i.test(qt) ||
            /argument (above |given |above given )?depends on/i.test(qt) ||
            /\bdepends on\b/i.test(qt) ||  // "the argument depends on" = assumption
            /requires? which of the following assumptions?/i.test(qt) ||
            /makes? which of the following assumptions?/i.test(qt) ||
            /relies on which of the following assumptions?/i.test(qt) ||
            /based on which of the following assumptions?/i.test(qt) ||
            /based on (the )?assumption/i.test(qt) ||
            /following assumptions? (about|regarding|concerning)/i.test(qt) ||
            /could not result unless which of the following were true/i.test(qt) ||
            /reasoning relies on which/i.test(qt) ||
            /objection.*based on doubts about the truth of which.*assumptions?/i.test(qt),
    },

    // ── Flaw ──────────────────────────────────────────────────────────────────
    {
        category: 'Flaw',
        test: (qt) =>
            /\bflaw(ed|s)?\b/i.test(qt) ||
            /vulnerable to (the )?(criticism|objection|charge)/i.test(qt) ||
            /most vulnerable to/i.test(qt) ||
            /error in (the )?reasoning/i.test(qt) ||
            /best criticism/i.test(qt) ||
            /\bflawed because\b/i.test(qt) ||
            /\bflawed in that\b/i.test(qt) ||
            /\bflawed primarily\b/i.test(qt) ||
            /fails to (consider|take into account|recognize|address)/i.test(qt) ||
            /argument (is|above is) flawed/i.test(qt) ||
            /reasoning is flawed/i.test(qt) ||
            /overlooks (the|a) (possibility|fact)/i.test(qt),
    },

    // ── Weaken ────────────────────────────────────────────────────────────────
    {
        category: 'Weaken',
        test: (qt) =>
            /\bweaken(s|ed)?\b/i.test(qt) ||
            /\bundermine(s|d)?\b/i.test(qt) ||
            /cast(s)? (the most |most )?(serious )?doubt/i.test(qt) ||
            /most seriously damage(s)? the/i.test(qt) ||
            /most seriously undermine(s)?/i.test(qt) ||
            /argue(s)? against/i.test(qt) ||
            /least (strongly )?support(s)?/i.test(qt) ||
            /count(s)? against/i.test(qt) ||
            /objection to (the )?argument/i.test(qt) ||
            /strongest objection/i.test(qt) ||
            /calls? into question/i.test(qt) ||
            /counter to (the |this )?(argument|conclusion|plan|position)/i.test(qt) ||
            /most serious(ly)? draw?back/i.test(qt) ||
            /drawback to (the )?plan/i.test(qt) ||
            /cause (her|his|the|their) plan to fail/i.test(qt) ||
            /arguing against (the )?(author|conclusion|argument|position|plan)/i.test(qt) ||
            /rebuttal.*proponent/i.test(qt) ||
            /reason for discount(ing)?/i.test(qt) ||
            /discount(ing)? the evidence/i.test(qt) ||
            /not increase|will not achieve|fail to (achieve|accomplish)/i.test(qt) ||
            /indicate.*serious (potential )?weakness/i.test(qt) ||
            /make.*petition.*misleading/i.test(qt) ||
            /strongest counter to/i.test(qt) ||
            /would the (plan|proposal|scheme).*most likely (fail|not succeed|go wrong)/i.test(qt),
    },

    // ── Strengthen ────────────────────────────────────────────────────────────
    {
        category: 'Strengthen',
        test: (qt) =>
            /\bstrengthen(s|ed)?\b/i.test(qt) ||
            /most strongly supports?/i.test(qt) ||
            /lend(s)? support/i.test(qt) ||
            /support(s)? the (conclusion|argument|claim)/i.test(qt) ||
            /provides? (the )?strongest support/i.test(qt) ||
            /most help(s)? to support/i.test(qt) ||
            /provides? most support/i.test(qt) ||
            /best support(s)?/i.test(qt) ||
            /most supports?/i.test(qt) ||
            /gives? (the )?strongest support/i.test(qt) ||
            /strongest (grounds|basis|reason|justification) for/i.test(qt) ||
            /best (logical )?justification for/i.test(qt) ||
            /best logical grounds? for/i.test(qt) ||
            /valid reason for/i.test(qt) ||
            /provides? a rationale for/i.test(qt) ||
            /provides? (additional )?evidence for/i.test(qt) ||
            /support(s)? (a prediction|the (position|contention|finding|claim))/i.test(qt) ||
            /would provide.*strongest (counter-argument|support)/i.test(qt) ||
            /most (help|useful) (in )?support/i.test(qt) ||
            /most strongly suggests? that the (conclusion|argument) (is correct|holds|is valid)/i.test(qt) ||
            /provide.*most additional support/i.test(qt) ||
            /(additions?|if added).*help.*most (in )?overcoming/i.test(qt) ||
            /if added.*would be most likely to help/i.test(qt) ||
            /strongest (counter-argument|grounds? for)/i.test(qt),
    },

    // ── Evaluate Argument ─────────────────────────────────────────────────────
    // (More specific evaluate phrasing — listed before generic Evaluate)
    {
        category: 'Evaluate Argument',
        test: (qt) =>
            /evaluating the argument/i.test(qt) ||
            /in (order )?to (assess|evaluate) (the strength|the force|the argument)/i.test(qt) ||
            /assess(ing)? the (support|strength|force) (provided|given)/i.test(qt) ||
            /determining the impact/i.test(qt) ||
            /compare.*(in|among|between)/i.test(qt),
    },

    // ── Evaluate ──────────────────────────────────────────────────────────────
    {
        category: 'Evaluate',
        test: (qt) =>
            /\bevaluate\b/i.test(qt) ||
            /most (useful|helpful|important) to (know|determine|consider|establish|find out)/i.test(qt) ||
            /would be most useful/i.test(qt) ||
            /most likely to yield (significant|useful|relevant) (information|insight|evidence)/i.test(qt) ||
            /answer.*would.*most (help|useful|important)/i.test(qt) ||
            /important (to know|for (evaluating|assessing|determining))/i.test(qt),
    },

    // ── Paradox ───────────────────────────────────────────────────────────────
    {
        category: 'Paradox',
        test: (qt) =>
            /\bexplain(s|ed)?\b/i.test(qt) ||
            /help(s)? to explain/i.test(qt) ||
            /helps? explain/i.test(qt) ||
            /account(s)? for/i.test(qt) ||
            /\bparadox\b/i.test(qt) ||
            /reconcil/i.test(qt) ||
            /resolv(e|es|ing) the (apparent |seeming )?(paradox|discrepancy|conflict|contradiction)/i.test(qt) ||
            /\bdiscrepancy\b/i.test(qt) ||
            /surprising (fact|finding|result)/i.test(qt) ||
            /why.*unusual/i.test(qt) ||
            /basis for an explanation/i.test(qt) ||
            /contribut(e|es|ion).*explanation/i.test(qt) ||
            /why only/i.test(qt),
    },

    // ── Conclusion ────────────────────────────────────────────────────────────
    // Asking for the *main conclusion*, *primary purpose/point*, or *structure of the argument*
    {
        category: 'Conclusion',
        test: (qt) =>
            /main (point|conclusion|purpose|claim|argument)/i.test(qt) ||
            /primarily concerned with/i.test(qt) ||
            /primary purpose/i.test(qt) ||
            /best (states?|expresses?|describes?) the (point|conclusion|argument|main)/i.test(qt) ||
            /what is the (main|overall|central) (point|conclusion|message|argument)/i.test(qt) ||
            /the author('s)? (main )?point (is|was)/i.test(qt) ||
            /passage proceeds by/i.test(qt) ||
            /argument (above |given )?proceeds by/i.test(qt) ||
            /which of the following most accurately (states?|expresses?)/i.test(qt) ||
            /\bconclusion\b.*\bdrawn\b/i.test(qt) ||
            /drawn.*\bconclusion\b/i.test(qt) ||
            /the (main |overall )?conclusion (that )?(can be |could be |is )?(drawn|reached|drawn from)/i.test(qt) ||
            /describes? the (organization|structure|method|development) of (the )?passage/i.test(qt) ||
            /best describes? how (the )?passage is (organized|structured|developed)/i.test(qt) ||
            /responds? to .* by (doing which|doing what)/i.test(qt) ||   // dialogue structure
            /argument (is|was) structured/i.test(qt) ||
            /argument('s)? structure/i.test(qt) ||
            /main (role|function) of the (passage|argument|second paragraph)/i.test(qt) ||
            /develops? the argument by/i.test(qt) ||
            /challenges? .* argument by (doing which|doing what)/i.test(qt) ||
            /responds? to .* by (doing)?\s*(which|what)/i.test(qt) ||
            /strategies? (is |are )?used in the presentation/i.test(qt) ||
            /argumentative strategy used/i.test(qt) ||
            /how .* counters? .* argument/i.test(qt) ||
            /most (like|similar to) the argument above in its logical structure/i.test(qt) ||
            /most analogous to the (underlying )?strategy/i.test(qt) ||
            /which of the following is most analogous/i.test(qt) ||
            /argument above is based on$/i.test(qt) ||  // bare "is based on" without "assumption"
            /best describes how (the )?(consumer|challenger|speaker|author|respondent) counters?/i.test(qt) ||
            /author.*primarily in order to/i.test(qt) ||
            /author (cites?|mentions?|lists?|refers? to|includes?|discusses?|uses?) .* (primarily |most likely |mainly )?(in order to|to (illustrate|support|show|demonstrate|emphasize|highlight|contrast))/i.test(qt) ||
            /functions? primarily to/i.test(qt) ||
            /best describes? the function of/i.test(qt) ||
            /best describes? the (relationship|connection) between/i.test(qt) ||
            /best characterize(s)? (the (function|role|purpose|nature|structure)|how)/i.test(qt) ||
            /best describes? (how|the way)/i.test(qt),
    },

    // ── Inference ─────────────────────────────────────────────────────────────
    {
        category: 'Inference',
        test: (qt) =>
            /\binfer(s|red|ence)?\b/i.test(qt) ||
            /\binferred\b/i.test(qt) ||
            /most strongly supported by/i.test(qt) ||
            /best supported by/i.test(qt) ||
            /properly drawn if/i.test(qt) ||
            /can (most properly |most logically )?be (inferred|concluded)/i.test(qt) ||
            /most likely (to be )?true/i.test(qt) ||
            /most reasonably (drawn|concluded|inferred)/i.test(qt) ||
            /the statements? above (best )?support(s)? the conclusion that/i.test(qt) ||
            // RC-style inference patterns
            /the passage suggests? that/i.test(qt) ||
            /the author('s)? attitude/i.test(qt) ||
            /according to the (passage|author)/i.test(qt) ||
            /the passage implies?/i.test(qt) ||
            /(agree|disagree) with which of the following/i.test(qt) ||
            /which of the following.*(agree|disagree)/i.test(qt) ||
            /the author (would most likely|suggests?|implies?|believes?|is most likely to)/i.test(qt) ||
            /best supported by the (passage|statements?|evidence)/i.test(qt) ||
            /passage (would most likely|is most likely to) (continue|be followed|support)/i.test(qt) ||
            /most likely (follow|come after|precede)/i.test(qt) ||
            /which of the following most likely (follows|continues)/i.test(qt) ||
            // "must be true" patterns
            /which of the following must (also )?be true/i.test(qt) ||
            /must be true on the basis/i.test(qt) ||
            /if the statements? above are true.*(which|what) of the following must/i.test(qt) ||
            /following must be true/i.test(qt) ||
            /it is also true that/i.test(qt) ||
            // RC detail/support patterns
            /the passage (states?|mentions?|provides?) which of the following/i.test(qt) ||
            /passage provides? (information|support|evidence) (to|for)/i.test(qt) ||
            /passage supplies? information/i.test(qt) ||
            /passage (explicitly )?(states?|says|mentions|criticizes|describes?)/i.test(qt) ||
            /all of the following (are mentioned|appear) in the passage/i.test(qt) ||
            /is mentioned in the passage as/i.test(qt) ||
            /does the author mention as/i.test(qt) ||
            /does the (passage|author) (mention|cite|include|list|discuss)/i.test(qt) ||
            /is (true|correct) (of|about) .* (as it is described|as described)/i.test(qt) ||
            /the (passage|author) views? .* (with|as)/i.test(qt) ||
            /author('s)? (attitude|tone|perspective|view|opinion)/i.test(qt) ||
            /author (expresses?|conveys?|reveals?)/i.test(qt) ||
            /the author is primarily (concerned|interested) in/i.test(qt) ||
            /passage is most relevant to/i.test(qt) ||
            /the author.*finds? .* to be/i.test(qt) ||
            /in comparison to .* the author finds/i.test(qt) ||
            /which of the following is true (of|about)/i.test(qt) ||
            /which of the following (can be|statements? can be) made about/i.test(qt) ||
            /point at issue between/i.test(qt) ||                          // dialogue disagreement = inference
            /according to (the )?(definition|information|theory|research)/i.test(qt),
    },
];

// ─── Classifier ───────────────────────────────────────────────────────────────

function classify(question) {
    const qt = question.content?.questionText || '';
    const p  = question.content?.passage || '';

    for (const rule of RULES) {
        if (rule.test(qt, p)) return rule.category;
    }
    return ''; // unknown — needs manual review
}

// ─── Process files ────────────────────────────────────────────────────────────

const files = process.argv.slice(2);
if (files.length === 0) {
    console.error('Usage: node recategorize.js <file1> [file2] ...');
    process.exit(1);
}

let grandTotalFixed = 0;
let grandTotalEmpty = 0;

const emptyReport = []; // { file, questionIndex, questionLink, questionText }

for (const filePath of files) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
        console.warn(`⚠ File not found: ${absPath}`);
        continue;
    }

    const data     = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    const basename = path.basename(absPath);

    let fixedCount = 0;
    let emptyCount = 0;
    const catCounts = {};

    for (const question of data.questions) {
        const newCat = classify(question);
        question.category = newCat;

        if (newCat) {
            fixedCount++;
            catCounts[newCat] = (catCounts[newCat] || 0) + 1;
        } else {
            emptyCount++;
            emptyReport.push({
                file:          basename,
                questionLink:  question.questionLink,
                questionText:  (question.content?.questionText || '').slice(0, 100),
                passage_tail:  (question.content?.passage || '').slice(-80),
            });
        }
    }

    // Update top-level category to reflect it's now mixed
    data.category = 'mixed';

    fs.writeFileSync(absPath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    grandTotalFixed += fixedCount;
    grandTotalEmpty += emptyCount;

    console.log(`\n✓ ${basename}`);
    console.log(`  ${fixedCount} categorized, ${emptyCount} need manual review`);
    const catLine = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}(${v})`)
        .join(', ');
    if (catLine) console.log(`  Breakdown: ${catLine}`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`Total categorized : ${grandTotalFixed}`);
console.log(`Need manual review: ${grandTotalEmpty}`);

if (emptyReport.length > 0) {
    console.log('\n' + '═'.repeat(60));
    console.log('MANUAL REVIEW REQUIRED (category left empty)\n');
    for (const e of emptyReport) {
        console.log(`File  : ${e.file}`);
        console.log(`Link  : ${e.questionLink}`);
        console.log(`QText : ${e.questionText || '(empty)'}`);
        if (!e.questionText) console.log(`P.end : ...${e.passage_tail}`);
        console.log();
    }

    // Also save a machine-readable list
    const reportPath = path.join(
        path.dirname(path.resolve(files[0])),
        `recategorize-manual-review-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(reportPath, JSON.stringify(emptyReport, null, 2) + '\n');
    console.log(`Manual review list saved to:\n  ${reportPath}`);
}
