<?php

require_once  '/var/www/vendor/autoload.php';

use Spatie\PdfToText\Pdf;
use LukeMadhanga\DocumentParser;

if(empty($_POST)){$_POST=json_decode(file_get_contents("php://input"), true);}

$text="";

if($_POST['processMethod']=="merged"){
  
  // Combine all files into single text
  
  foreach($_FILES['file']['tmp_name'] as $i=>$tmp_name){
    $type=$_FILES['file']['type'][$i];
    if($type=="application/pdf"){
      $text.=Pdf::getText($tmp_name);
    }
    elseif($type=="application/vnd.openxmlformats-officedocument.wordprocessingml.document" || $type=="application/msword"){
      $t=DocumentParser::parseFromFile($tmp_name,$type);
      $tags = array('</p>','<br />','<br>','<hr />','<hr>','</h1>','</h2>','</h3>','</h4>','</h5>','</h6>');
      $t = str_replace($tags,"\n",$t);
      $text.=strip_tags($t);
    }elseif($type=='text/plain'){
      $text.=file_get_contents($tmp_name);
    }
  }
  
  // Remove line-breaks
  
  $text = str_replace(array("\r", "\n"), ' ', $text);
  $text=preg_replace("/[ ]+/"," ",$text);
  
  // Get SpaCy tags
  
  $tags = getTags($text);

  echo json_encode(["result"=>"success","tags"=>$tags]);
  
} else if($_POST['processMethod']=="batched"){
  echo json_encode(["result"=>"error","message"=>"Batched processing isn't available at this time!","text"=>$text,"files"=>$_FILES,"post"=>$_POST]);
} else if($_POST['processMethod']=="copypaste"){
  
  // Remove line-breaks
  
  $text = str_replace(array("\r", "\n"), ' ', $_POST['pastedText']);
  $text=preg_replace("/[ ]+/"," ",$text);
  
  // Get SpaCy tags
  
  $tags = getTags($text);
  
  echo json_encode(["result"=>"success","tags"=>$tags]);
  
}

function getTags($text){
  
  // Load ESLA data
  
  $esla_lines=explode("\n",file_get_contents("/var/www/esla.csv"));
  $esla_data=[];
  foreach($esla_lines as $line){
    $elements=explode("\t",$line);
    $esla_data[]=[
      "headword"=>$elements[0],
      "types"=>explode(" ",$elements[1]),
      "1300"=>floatval($elements[2]),
      "1500"=>floatval($elements[3]),
      "1900"=>floatval($elements[4]),
      "awl"=>boolval($elements[5]),
    ];
  }
  
  $esla_types_array=array_column($esla_data, 'types');
  
  // Tag text with SpaCy
  
  $unqiue=uniqid();
  file_put_contents("/var/www/temp/".$unqiue.".txt",trim($text));
  
  $output = shell_exec('/var/www/.env/bin/python3 /var/www/process.py '.$unqiue);
  preg_match_all("/\('[^)]+\)/",$output,$matches);
  $tags=[];
  foreach($matches[0] as $match){
    $match=trim($match,'()');
    $elements=explode(", ",$match);
    $word=trim($elements[0],"'");
    $pos=trim($elements[1],"'");
    $tags[]=[
      "word"=>$word,
      "pos"=>$pos,
      "esla_item"=>getEslaItemByHeadword($esla_types_array,$esla_data,$word)
    ];
  }
  
  unlink("/var/www/temp/".$unique.".txt");
  return $tags;
}

function getEslaItemByHeadword($esla_types_array,$esla_data,$headword){
  $key=false;
  foreach($esla_types_array as $i=>$array){
    if(in_array(strtoupper($headword),$array)){
      $key=$i;
    }
  }
  if($key!==false){
    return $esla_data[$key];
  }else{
    return null;
  }
}

?>