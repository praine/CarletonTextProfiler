<?php

require_once  '/var/www/vendor/autoload.php';

use Spatie\PdfToText\Pdf;
use LukeMadhanga\DocumentParser;
use \ForceUTF8\Encoding;

ini_set('max_execution_time', 0);
$start = microtime(true);

$errorHandler = new \Whoops\Run;

$errorHandler->pushHandler(function ($e) {
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
    $txt = $e->getMessage() . " at line " . $e->getLine() . " in " . $e->getFile();
    file_put_contents($path, $time . "\t" . $txt . PHP_EOL, FILE_APPEND | LOCK_EX);
    die($txt);
});

$errorHandler->register();

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
    
    // Convert all non-unicode characters
    $text = Encoding::toUTF8($text);
    
    // Convert all non-standard apostrophe types
    
    $text=standardizeApostrophesToStraight($text);
    
    $tags_array[] = ["fileName"=>$fileName,"text"=>$text];
    
  }

  $mergedText=implode(" ",array_map(function($e){return $e['text'];},$tags_array));
  $wordCount=str_word_count($mergedText);
  
  if($wordCount>$maxWords[$_POST['processMethod']]){
    die(json_encode(["result"=>"error","message"=>"Uploaded text exceeds maximum word length.<br/> Total text length: ".$wordCount." words | Max length: ".$maxWords[$_POST['processMethod']]." words"]));
  }
  
  write_log("Processing ".$wordCount." words..");
  
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
  
  // Convert all non-unicode characters
  $text = Encoding::toUTF8($text);
  
  // Convert all non-standard apostrophe types
  $text=standardizeApostrophesToStraight($text);
  
  $wordCount=str_word_count($text);
  
  if($wordCount>$maxWords){
    die(json_encode(["result"=>"error","message"=>"Uploaded text exceeds maximum word length.<br/> Total text length: ".$wordCount." words | Max length: ".$maxWords." words"]));
  }
  
  write_log("Processing ".$wordCount." words..");
    
  $tags_array[] = ["fileName"=>"Pasted Text","text"=>$text,"tags"=>getTags($text)];
  
  $time_elapsed_secs = round(microtime(true) - $start);
  write_log("Process took " . $time_elapsed_secs . " seconds!");
  echo json_encode(["result"=>"success","tags_array"=>$tags_array]);
  
}

function getTags($text){
    
    write_log($text);
    // Load ESLA data
    write_log("Loading ESLA data...");
    $esla_data = loadEslaData("/var/www/esla.csv");
    $esla_lookup = buildEslaLookup($esla_data);

    // Tag text with SpaCy
    write_log("Tagging text with SpaCy...");
    $unique = uniqid();
    file_put_contents("/var/www/temp/{$unique}.txt", trim($text));

    $output = shell_exec("/var/www/.env/bin/python3 /var/www/process.py $unique");
    write_log($output);
    $lines=explode("\n",trim($output));
    $tags = [];
  
    write_log("Matching tags to ESLA items...");
  
    foreach($lines as $line){
      $elements=explode("\t",$line);
      $word=trim($elements[0],'"');
      $pos=trim($elements[1],'"');
      $tags[] = [
          "word" => $word,
          "pos" => $pos,
          "esla_item" => $esla_lookup[strtoupper($word)] ?? null
      ];
    }

    unlink("/var/www/temp/{$unique}.txt");

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

function convertCurlyQuotes($text){
  
    write_log($text);
  
    $quoteMapping = [
        // U+0082⇒U+201A single low-9 quotation mark
        "\xC2\x82"     => "'",

        // U+0084⇒U+201E double low-9 quotation mark
        "\xC2\x84"     => '"',

        // U+008B⇒U+2039 single left-pointing angle quotation mark
        "\xC2\x8B"     => "'",

        // U+0091⇒U+2018 left single quotation mark
        "\xC2\x91"     => "'",

        // U+0092⇒U+2019 right single quotation mark
        "\xC2\x92"     => "'",

        // U+0093⇒U+201C left double quotation mark
        "\xC2\x93"     => '"',

        // U+0094⇒U+201D right double quotation mark
        "\xC2\x94"     => '"',

        // U+009B⇒U+203A single right-pointing angle quotation mark
        "\xC2\x9B"     => "'",

        // U+00AB left-pointing double angle quotation mark
        "\xC2\xAB"     => '"',

        // U+00BB right-pointing double angle quotation mark
        "\xC2\xBB"     => '"',

        // U+2018 left single quotation mark
        "\xE2\x80\x98" => "'",

        // U+2019 right single quotation mark
        "\xE2\x80\x99" => "'",

        // U+201A single low-9 quotation mark
        "\xE2\x80\x9A" => "'",

        // U+201B single high-reversed-9 quotation mark
        "\xE2\x80\x9B" => "'",

        // U+201C left double quotation mark
        "\xE2\x80\x9C" => '"',

        // U+201D right double quotation mark
        "\xE2\x80\x9D" => '"',

        // U+201E double low-9 quotation mark
        "\xE2\x80\x9E" => '"',

        // U+201F double high-reversed-9 quotation mark
        "\xE2\x80\x9F" => '"',

        // U+2039 single left-pointing angle quotation mark
        "\xE2\x80\xB9" => "'",

        // U+203A single right-pointing angle quotation mark
        "\xE2\x80\xBA" => "'",

        // HTML left double quote
        "&ldquo;"      => '"',

        // HTML right double quote
        "&rdquo;"      => '"',

        // HTML left sinqle quote
        "&lsquo;"      => "'",

        // HTML right single quote
        "&rsquo;"      => "'",
    ];

    // Decode any HTML entities first.
    $decodedText = html_entity_decode($text, ENT_QUOTES, "UTF-8");

    // Now iterate over the mapping array and check for each character.
    foreach ($quoteMapping as $original => $replacement) {
        $pos = mb_strpos($decodedText, $original);
        if ($pos !== false) {
            // Log the character found and its replacement.
            write_log("Replacing character " . bin2hex($original) . " at position $pos with $replacement.\n");
        }
        // We do not replace it here to avoid double logging for multiple occurrences.
    }

    // After logging, perform the actual replacement.
    return strtr($decodedText, $quoteMapping);
  
}

function standardizeApostrophesToStraight($text) {
    // Define an array with the different types of apostrophes and similar characters to be replaced
    // This now includes the backtick (`) character
    $apostrophes = array("\u{2019}", "\u{2018}", "\u{201B}", "\u{02BC}", "\u{02BB}", "\u{2032}", "\u{FF07}", "`");

    // The standard straight apostrophe to replace with
    $standardStraightApostrophe = "'"; // U+0027 APOSTROPHE

    // Replace all occurrences of the apostrophes in the text
    $text = str_replace($apostrophes, $standardStraightApostrophe, $text);

    return $text;
}

?>