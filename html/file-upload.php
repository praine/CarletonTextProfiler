<?php

require_once  '/var/www/vendor/autoload.php';

use Spatie\PdfToText\Pdf;
use LukeMadhanga\DocumentParser;
ini_set('max_execution_time', 0);
$start = microtime(true);

if(empty($_POST)){$_POST=json_decode(file_get_contents("php://input"), true);}

$text="";
$tags_array=[];
$maxWords=["batched"=>25000,"merged"=>5000];

if($_POST['processMethod']=="batched" || $_POST['processMethod']=="merged"){
  
  write_log("Processing ".count(array_filter($_FILES['file']['name']))." files in ".$_POST['processMethod']." mode...");
      
  foreach($_FILES['file']['tmp_name'] as $i=>$tmp_name){
    
    $type=$_FILES['file']['type'][$i];
    
    $fileName=$_FILES['file']['name'][$i];
    if($type=="application/pdf"){
      $text=Pdf::getText($tmp_name);
    }
    elseif($type=="application/vnd.openxmlformats-officedocument.wordprocessingml.document" || $type=="application/msword"){
      $t=DocumentParser::parseFromFile($tmp_name,$type);
      $tags = array('</p>','<br />','<br>','<hr />','<hr>','</h1>','</h2>','</h3>','</h4>','</h5>','</h6>');
      $t = str_replace($tags,"\n",$t);
      $text=strip_tags($t);
    }elseif($type=='text/plain'){
      $text=file_get_contents($tmp_name);
    }
    
    // Remove line-breaks
  
    $text = str_replace(array("\r", "\n"), ' ', $text);
    $text=preg_replace("/[ ]+/"," ",$text);
    $tags_array[] = ["fileName"=>$fileName,"text"=>$text];
    
  }

  $mergedText=implode(" ",array_map(function($e){return $e['text'];},$tags_array));
  $wordCount=str_word_count($mergedText);
  
  if($wordCount>$maxWords[$_POST['processMethod']]){
    die(json_encode(["result"=>"error","message"=>"Uploaded text exceeds maximum word length.<br/> Total text length: ".$wordCount." words | Max length: ".$maxWords[$_POST['processMethod']]." words"]));
  }
  
  if($_POST['processMethod']=="batched"){
    foreach($tags_array as $idx=>$array){
      $tags_array[$idx]['tags']=getTags($array['text']);
    }
  }
  
  else if($_POST['processMethod']=="merged"){
    $tags_array=[["fileName"=>"Merged Text","text"=>$mergedText,"tags"=>getTags($mergedText)]];
  }
    
  $time_elapsed_secs = round(microtime(true) - $start,1);
  write_log("Process took " . $time_elapsed_secs . " seconds!");
  echo json_encode(["result"=>"success","tags_array"=>$tags_array]);
  
} else if($_POST['processMethod']=="copypaste"){
  
  // Remove line-breaks
  
  $text = str_replace(array("\r", "\n"), ' ', $_POST['pastedText']);
  $text=preg_replace("/[ ]+/"," ",$text);
  $wordCount=str_word_count($text);
  
  if($wordCount>$maxWords){
    die(json_encode(["result"=>"error","message"=>"Uploaded text exceeds maximum word length.<br/> Total text length: ".$wordCount." words | Max length: ".$maxWords." words"]));
  }
    
  $tags_array[] = ["fileName"=>"Pasted Text","text"=>$text,"tags"=>getTags($text)];
  
  $time_elapsed_secs = microtime(true) - $start;
  write_log("Process took " . $time_elapsed_secs . " seconds!");
  echo json_encode(["result"=>"success","tags_array"=>$tags_array]);
  
}

function getTags($text){
    $start = microtime(true);

    // Load ESLA data
    write_log("Loading ESLA data...");
    $esla_data = loadEslaData("/var/www/esla.csv");
    $esla_lookup = buildEslaLookup($esla_data);

    // Tag text with SpaCy
    write_log("Tagging text with SpaCy...");
    $unique = uniqid();
    file_put_contents("/var/www/temp/{$unique}.txt", trim($text));

    $output = shell_exec("/var/www/.env/bin/python3 /var/www/process.py $unique");
    preg_match_all("/\([^)]+\)/", $output, $matches);
    $tags = [];

    write_log("Matching tags to ESLA items...");
    foreach ($matches[0] as $i => $match) {
        list($word, $pos) = array_map('trim', explode(", ", trim($match, '()')));
        $word = trim($word, '"');
        $tags[] = [
            "word" => $word,
            "pos" => trim($pos, '"'),
            "esla_item" => $esla_lookup[strtoupper($word)] ?? null
        ];
    }

    unlink("/var/www/temp/{$unique}.txt");
    write_log("Process took " . (microtime(true) - $start) . " seconds!");

    return $tags;
}

function loadEslaData($filename) {
    $lines = explode("\n", file_get_contents($filename));
    $data = [];
    foreach ($lines as $line) {
        $elements = explode("\t", $line);
        $data[] = [
            "headword" => $elements[0],
            "types" => explode(" ", $elements[1]),
            "1300" => floatval($elements[2]),
            "1500" => floatval($elements[3]),
            "1900" => floatval($elements[4]),
            "awl" => boolval($elements[5])
        ];
    }
    return $data;
}

function buildEslaLookup($esla_data) {
    $lookup = [];
    foreach ($esla_data as $item) {
        // Add entry for the headword itself
        $lookup[strtoupper($item["headword"])] = $item;

        // Add entries for each type
        foreach ($item["types"] as $type) {
            $lookup[strtoupper($type)] = $item;
        }
    }
    return $lookup;
}

function write_log($txt)
    {

      $tz = 'Asia/Tokyo';
      $tz_obj = new DateTimeZone($tz);
      $today = new DateTime("now", $tz_obj);
      $date = $today->format('Y-m-d');
      $time = $today->format('H:i:s');
      $path = '/var/www/logs/' . $date . ".txt";
      if (!file_exists($path)) {
          touch($path);
          chmod($path, 0777);
      }
      file_put_contents($path, $time . "\t" . $txt . PHP_EOL, FILE_APPEND | LOCK_EX);
    }

?>