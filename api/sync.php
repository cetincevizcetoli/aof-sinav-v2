<?php
require __DIR__ . '/db.php';
$user = token_user($pdo,$SECRET);
if (!$user) return err(401,'unauth');
$a = $_GET['action'] ?? '';
// read hard reset timestamp
$resetAt = 0; try { $stMeta = $pdo->prepare('SELECT reset_at FROM user_meta WHERE user_id=?'); $stMeta->execute([$user]); $mrow = $stMeta->fetch(PDO::FETCH_ASSOC); if ($mrow && isset($mrow['reset_at'])) $resetAt = intval($mrow['reset_at']); } catch (Throwable $e) {}
if ($a === 'check_version') {
    $m1 = 0; $m2 = 0; $m3 = 0;
    try { $st = $pdo->prepare('SELECT MAX(updated_at) AS m FROM progress WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m1 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    try { $st = $pdo->prepare('SELECT MAX(updated_at) AS m FROM user_stats WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m2 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    try { $st = $pdo->prepare('SELECT MAX(date) AS m FROM exam_history WHERE user_id=?'); $st->execute([$user]); $r = $st->fetch(PDO::FETCH_ASSOC); $m3 = intval($r['m'] ?? 0); } catch (Throwable $e) {}
    $last = max($m1,$m2,$m3);
    ok(['last_server_update'=>$last]);
    exit;
}
if ($a === 'push') {
    $in = json();
    $progress = $in['progress'] ?? [];
    $selP = $pdo->prepare('SELECT updated_at FROM progress WHERE id=? AND user_id=?');
    $insP = $pdo->prepare('INSERT INTO progress(id,user_id,lesson,unit,level,nextReview,correct,wrong,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    $updP = $pdo->prepare('UPDATE progress SET user_id=?, lesson=?, unit=?, level=?, nextReview=?, correct=?, wrong=?, updated_at=? WHERE id=? AND user_id=?');
    foreach ($progress as $p) {
        $pid = $p['id']??''; if(!$pid) continue;
        $inc = intval($p['updated_at']??0);
        if ($resetAt && ($inc === 0 || $inc < $resetAt)) continue;
        $selP->execute([$pid, $user]);
        $row = $selP->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $insP->execute([$pid, $user, $p['lesson']??'', intval($p['unit']??0), intval($p['level']??0), intval($p['nextReview']??0), intval($p['correct']??0), intval($p['wrong']??0), ($inc ?: time())]);
        } else {
            $cur = intval($row['updated_at']??0);
            if ($inc > $cur) {
                $updP->execute([$user, $p['lesson']??'', intval($p['unit']??0), intval($p['level']??0), intval($p['nextReview']??0), intval($p['correct']??0), intval($p['wrong']??0), ($inc ?: time()), $pid, $user]);
            }
        }
    }
    if (isset($in['stats'])) {
        $s = $in['stats'];
        $incS = intval($s['updated_at']??0);
        if ($resetAt && ($incS === 0 || $incS < $resetAt)) { /* ignore stale */ } else {
        $selS = $pdo->prepare('SELECT updated_at FROM user_stats WHERE user_id=?');
        $selS->execute([$user]);
        $rowS = $selS->fetch(PDO::FETCH_ASSOC);
        if (!$rowS) {
            $pdo->prepare('INSERT INTO user_stats(user_id,xp,streak,totalQuestions,updated_at) VALUES(?,?,?,?,?)')->execute([$user, intval($s['xp']??0), intval($s['streak']??0), intval($s['totalQuestions']??0), ($incS ?: time())]);
        } else {
            $curS = intval($rowS['updated_at']??0);
            if ($incS > $curS) {
                 $pdo->prepare('UPDATE user_stats SET xp=?, streak=?, totalQuestions=?, updated_at=? WHERE user_id=?')->execute([intval($s['xp']??0), intval($s['streak']??0), intval($s['totalQuestions']??0), ($incS ?: time()), $user]);
        }
        }
    }
    }
    if (isset($in['history']) && is_array($in['history'])) {
        $ins = $pdo->prepare('INSERT IGNORE INTO exam_history(user_id,date,lesson,unit,isCorrect,uuid,qid,given_option,cycle_no) VALUES(?,?,?,?,?,?,?,?,?)');
        foreach ($in['history'] as $h) { $hd = intval($h['date']??time()); if ($resetAt && $hd < $resetAt) continue; $ins->execute([$user, $hd, $h['lesson']??'', intval($h['unit']??0), intval(($h['isCorrect']??0)?1:0), (string)($h['uuid']??''), (string)($h['qid']??''), (string)($h['given_option']??''), intval($h['cycle_no']??0)]); }
    }
    if (isset($in['sessions']) && is_array($in['sessions'])) {
        $insS = $pdo->prepare('INSERT IGNORE INTO study_sessions(user_id,lesson,unit,mode,started_at,ended_at,uuid,cycle_no) VALUES(?,?,?,?,?,?,?,?)');
        foreach ($in['sessions'] as $s) { $st = intval($s['started_at']??0); if ($resetAt && ($st === 0 || $st < $resetAt)) continue; $insS->execute([$user, $s['lesson']??'', intval($s['unit']??0), $s['mode']??'study', ($st ?: time()), intval($s['ended_at']??0), (string)($s['uuid']??''), intval($s['cycle_no']??0)]); }
    }
    ok(['pushed'=>true]);
} elseif ($a === 'pull') {
    $progress = $pdo->prepare('SELECT id,lesson,unit,level,nextReview,correct,wrong,updated_at FROM progress WHERE user_id=?');
    $progress->execute([$user]);
    $stats = $pdo->prepare('SELECT xp,streak,totalQuestions,updated_at FROM user_stats WHERE user_id=?');
    $stats->execute([$user]);
    $hist = $pdo->prepare('SELECT date,lesson,unit,isCorrect,uuid,qid,given_option,cycle_no FROM exam_history WHERE user_id=? ORDER BY date DESC LIMIT 500');
    $hist->execute([$user]);
    $sess = $pdo->prepare('SELECT lesson,unit,mode,started_at,ended_at,uuid,cycle_no FROM study_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 1000');
    $sess->execute([$user]);
    ok(['progress'=>$progress->fetchAll(PDO::FETCH_ASSOC),'stats'=>$stats->fetch(PDO::FETCH_ASSOC)?:['xp'=>0,'streak'=>0,'totalQuestions'=>0,'updated_at'=>0],'history'=>$hist->fetchAll(PDO::FETCH_ASSOC),'sessions'=>$sess->fetchAll(PDO::FETCH_ASSOC),'reset_at'=>$resetAt]);
} elseif ($a === 'wipe') {
    try {
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM progress WHERE user_id=?')->execute([$user]);
        $pdo->prepare('DELETE FROM user_stats WHERE user_id=?')->execute([$user]);
        $pdo->prepare('DELETE FROM exam_history WHERE user_id=?')->execute([$user]);
        try { $pdo->prepare('DELETE FROM study_sessions WHERE user_id=?')->execute([$user]); } catch (Throwable $e) {}
        // mark reset timestamp for conflict resolution
        try { $pdo->prepare('INSERT INTO user_meta(user_id, reset_at) VALUES(?,?) ON DUPLICATE KEY UPDATE reset_at=VALUES(reset_at)')->execute([$user, time()]); } catch (Throwable $e) {}
        $pdo->commit();
        ok(['wiped'=>true, 'reset_at'=>time()]);
    } catch(Exception $e){ $pdo->rollBack(); return err(500,'server_error'); }
} else { err(404,'notfound'); }
