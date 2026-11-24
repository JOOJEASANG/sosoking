// Historical 01X → 010 blocks from SK Telecom's public conversion table.
// Not a current subscriber / contact lookup.
const codes=new Set(['011','016','017','018','019']);
const table={
 '011':[
  [3,200,499,x=>'5'+x], [3,500,899,x=>'3'+x],
  [4,1700,1799,x=>'71'+x.slice(2)], [4,9000,9499,x=>x], [4,9500,9999,x=>'8'+x.slice(1)]
 ],
 '016':[[3,200,499,x=>'3'+x],[3,500,899,x=>'2'+x],[4,9200,9499,x=>'7'+x.slice(1)],[4,9500,9999,x=>x]],
 '017':[[3,200,499,x=>'6'+x],[3,500,899,x=>'4'+x]],
 '018':[[3,200,499,x=>'4'+x],[3,500,899,x=>'6'+x]],
 '019':[[3,200,499,x=>'2'+x],[3,500,899,x=>'5'+x],[4,9000,9499,x=>'8'+x.slice(1)],[4,9500,9999,x=>'7'+x.slice(1)]]
};
export function convertOldNumber(raw){
 const v=String(raw??'').replace(/[^0-9]/g,'');
 if(v.length!==10&&v.length!==11)return {ok:false,reason:'전화번호는 10자리 또는 11자리로 입력해 주세요.'};
 const prefix=v.slice(0,3),middle=v.slice(3,-4),tail=v.slice(-4);
 if(!codes.has(prefix))return {ok:false,reason:'011·016·017·018·019로 시작하는 옛 휴대폰 번호만 계산할 수 있습니다.'};
 const match=table[prefix].find(([len,min,max])=>len===middle.length&&Number(middle)>=min&&Number(middle)<=max);
 if(!match)return {ok:false,reason:'이 중간 번호는 확인된 전환표에 없습니다. 실제 번호를 추정하지 않겠습니다.'};
 const part=match[3](middle);
 return {ok:true,old:`${prefix}-${middle}-${tail}`,estimated:`010-${part}-${tail}`,source:'SK텔레콤 2022년 01X 전환 안내',disclaimer:'전환 당시의 규칙 적용 결과일 뿐, 현재 실제 사용번호를 확인하거나 보장하지 않습니다.'};
}
