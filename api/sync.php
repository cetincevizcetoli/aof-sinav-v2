<?php
require __DIR__ . '/db.php';
$user = token_user($pdo,$SECRET);
if (!$user) return err(401,'unauth');
$a = $_GET['action'] ?? '';
if ($a === 'push') {
    $in = json();
    $progress = $in['progress'] ?? [];
    foreach ($progress as $p) {
        $pdo->prepare('INSERT INTO progress(id,user_id,lesson,unit,level,nextReview,correct,wrong,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,lesson=excluded.lesson,unit=excluded.unit,level=excluded.level,nextReview=excluded.nextReview,correct=excluded.correct,wrong=excluded.wrong,updated_at=excluded.updated_at')->execute([
            $p['id']??'', $user, $p['lesson']??'', intval($p['unit']??0), intval($p['level']??0), intval($p['nextReview']??0), intval($p['correct']??0), intval($p['wrong']??0), time()
        ]);
    }
    if (isset($in['stats'])) {
        $s = $in['stats'];
        $pdo->prepare('INSERT INTO user_stats(user_id,xp,streak,totalQuestions,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET xp=excluded.xp,streak=excluded.streak,totalQuestions=excluded.totalQuestions,updated_at=excluded.updated_at')->execute([$user, intval($s['xp']??0), intval($s['streak']??0), intval($s['totalQuestions']??0), time()]);
    }
    if (isset($in['history']) && is_array($in['history'])) {
        $ins = $pdo->prepare('INSERT INTO exam_history(user_id,date,lesson,unit,isCorrect) VALUES(?,?,?,?,?)');
        foreach ($in['history'] as $h) { $ins->execute([$user, intval($h['date']??time()), $h['lesson']??'', intval($h['unit']??0), intval(($h['isCorrect']??0)?1:0)]); }
    }
    ok(['pushed'=>true]);
} elseif ($a === 'pull') {
    $progress = $pdo->prepare('SELECT id,lesson,unit,level,nextReview,correct,wrong FROM progress WHERE user_id=?');
    $progress->execute([$user]);
    $stats = $pdo->prepare('SELECT xp,streak,totalQuestions FROM user_stats WHERE user_id=?');
    $stats->execute([$user]);
    $hist = $pdo->prepare('SELECT date,lesson,unit,isCorrect FROM exam_history WHERE user_id=? ORDER BY date DESC LIMIT 500');
    $hist->execute([$user]);
    ok(['progress'=>$progress->fetchAll(PDO::FETCH_ASSOC),'stats'=>$stats->fetch(PDO::FETCH_ASSOC)?:['xp'=>0,'streak'=>0,'totalQuestions'=>0],'history'=>$hist->fetchAll(PDO::FETCH_ASSOC)]);
} else { err(404,'notfound'); }
