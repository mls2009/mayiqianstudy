/* A small WebGL renderer for a hollow, hinged sphere; no 3D library or remote assets. */
(function(root) {
    const unit=v=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
    const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
    const turn=(p,a)=>[p[0],p[1]*Math.cos(a)+p[2]*Math.sin(a),-p[1]*Math.sin(a)+p[2]*Math.cos(a)];
    function rotateLid(p,angle) {const q=turn([p[0],p[1],p[2]+1],angle);return [q[0],q[1],q[2]-1];}
    const materials={red:[192,24,43],white:[226,233,240],seal:[24,33,46],inner:[167,183,199],rim:[123,140,158],button:[239,246,249],bezel:[51,65,83]};
    function buildGeometry() {
        const faces=[],segments=64;
        function face(vertices,normal,material,part,lid=false,normals=null) {
            faces.push({vertices,normal:unit(normal),normals:normals||vertices.map(()=>unit(normal)),material,part,lid});
        }
        const point=(latitude,longitude,r)=>[r*Math.cos(latitude)*Math.sin(longitude),r*Math.sin(latitude),r*Math.cos(latitude)*Math.cos(longitude)];
        function surface(start,end,r,material,part,lid,inside=false,rows=12) {
            for(let row=0;row<rows;row++)for(let j=0;j<segments;j++) {
                const a=start+(end-start)*row/rows,b=start+(end-start)*(row+1)/rows,c=j*Math.PI*2/segments,d=(j+1)*Math.PI*2/segments;
                const vertices=[point(a,c,r),point(a,d,r),point(b,d,r),point(b,c,r)];
                const normal=unit(point((a+b)/2,(c+d)/2,1)).map(n=>inside?-n:n);
                face(vertices,normal,material,part,lid,vertices.map(v=>unit(v).map(n=>inside?-n:n)));
            }
        }
        surface(.045,Math.PI/2,1,'red','upper-shell',true);
        surface(-Math.PI/2,-.045,1,'white','lower-shell',false);
        surface(0,.045,1.003,'seal','upper-seal',true,false,1);
        surface(-.045,0,1.003,'seal','lower-seal',false,false,1);
        surface(0,Math.PI/2,.915,'inner','upper-inner',true,true,9);
        surface(-Math.PI/2,0,.915,'inner','lower-inner',false,true,9);
        for(const lid of [false,true])for(let j=0;j<segments;j++) {
            const a=j*Math.PI*2/segments,b=(j+1)*Math.PI*2/segments;
            face([[Math.sin(a),0,Math.cos(a)],[Math.sin(b),0,Math.cos(b)],[.915*Math.sin(b),0,.915*Math.cos(b)],[.915*Math.sin(a),0,.915*Math.cos(a)]],[0,lid?-1:1,0],'rim',lid?'upper-rim':'lower-rim',lid);
        }
        // The latch is attached to the stationary lower shell, in front of the equatorial seal.
        for(let j=0;j<segments;j++) {
            const a=j*Math.PI*2/segments,b=(j+1)*Math.PI*2/segments;
            face([[.225*Math.cos(a),.225*Math.sin(a)-.025,1.008],[.225*Math.cos(b),.225*Math.sin(b)-.025,1.008],[.225*Math.cos(b),.225*Math.sin(b)-.025,1.075],[.225*Math.cos(a),.225*Math.sin(a)-.025,1.075]],[Math.cos((a+b)/2),Math.sin((a+b)/2),0],'bezel','button');
        }
        for(const [radius,z,material] of [[.225,1.075,'seal'],[.177,1.081,'rim'],[.143,1.088,'bezel'],[.116,1.095,'button']]) {
            face(Array.from({length:segments},(_,j)=>{const a=j*Math.PI*2/segments;return [radius*Math.cos(a),radius*Math.sin(a)-.025,z];}),[0,0,1],material,'button');
        }
        // A physical pin runs through the rear seam, exactly on the rotation axis.
        for(let j=0;j<24;j++) {
            const a=j*Math.PI*2/24,b=(j+1)*Math.PI*2/24;
            face([[-.21,.055*Math.cos(a),-1+.055*Math.sin(a)],[.21,.055*Math.cos(a),-1+.055*Math.sin(a)],[.21,.055*Math.cos(b),-1+.055*Math.sin(b)],[-.21,.055*Math.cos(b),-1+.055*Math.sin(b)]],[0,Math.cos((a+b)/2),Math.sin((a+b)/2)],'bezel','hinge');
        }
        return faces;
    }
    function mount(canvas,{master=false}={}) {
        const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:true}),ratio=Math.min(root.devicePixelRatio||1,2);
        canvas.width=400*ratio;canvas.height=440*ratio;gl.viewport(0,0,canvas.width,canvas.height);
        function shader(type,source) {
            const item=gl.createShader(type);gl.shaderSource(item,source);gl.compileShader(item);if(!gl.getShaderParameter(item,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(item));return item;
        }
        const vertex=shader(gl.VERTEX_SHADER,`
            precision mediump float;
            attribute vec3 position,normal,baseColor;
            attribute float lid,interior,button;
            uniform float angle,masterBall;
            varying vec3 world,surfaceNormal,color,localPosition;
            varying float inside,isButton;
            vec3 rotate(vec3 p) {return vec3(p.x,p.y*cos(angle)+p.z*sin(angle),-p.y*sin(angle)+p.z*cos(angle));}
            void main() {
                world=lid>.5?rotate(position+vec3(0.,0.,1.))-vec3(0.,0.,1.):position;
                surfaceNormal=lid>.5?rotate(normal):normal;
                localPosition=position;
                color=baseColor;
                if(masterBall>.5) {
                    if(baseColor.r>.6&&baseColor.g<.2)color=vec3(.88,.62,.14);
                    else if(baseColor.r>.8&&baseColor.g>.8&&baseColor.b>.8)color=vec3(.95,.86,.63);
                }
                inside=interior;isButton=button;
                float elevation=atan(1.55,5.);
                float y=world.y*cos(elevation)-world.z*sin(elevation);
                float depth=world.y*sin(elevation)+world.z*cos(elevation);
                float distance=length(vec2(1.55,5.)),w=distance-depth;
                gl_Position=vec4(world.x*112.*distance/200.,y*112.*distance/220.-94./220.*w,16./14.*w-30./14.,w);
            }
        `);
        const fragment=shader(gl.FRAGMENT_SHADER,`
            precision mediump float;
            varying vec3 world,surfaceNormal,color,localPosition;
            varying float inside,isButton;
            uniform float angle,glow,masterBall;
            float lineDistance(vec2 p,vec2 a,vec2 b) {vec2 d=b-a;return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.,1.));}
            void main() {
                vec3 n=normalize(surfaceNormal),view=normalize(vec3(0.,1.55,5.)-world);
                if(dot(n,view)<=0.)discard;
                vec3 light=normalize(vec3(-.65,1.15,1.5)),halfway=normalize(light+view);
                float diffuse=max(0.,dot(n,light)),shine=max(0.,dot(n,halfway));
                float specular=pow(shine,52.),soft=pow(shine,7.);
                vec3 paint=color;
                if(masterBall>.5&&localPosition.z>.5&&inside<.5&&localPosition.y>.08) {
                    float shoulder=length(vec2(abs(localPosition.x)-.49,localPosition.y-.32));
                    if(shoulder<.155)paint=vec3(.48,.20,.38);
                    vec2 p=localPosition.xy;
                    float m=min(lineDistance(p,vec2(-.20,.29),vec2(-.20,.61)),lineDistance(p,vec2(-.20,.61),vec2(0.,.39)));
                    m=min(m,lineDistance(p,vec2(0.,.39),vec2(.20,.61)));
                    m=min(m,lineDistance(p,vec2(.20,.61),vec2(.20,.29)));
                    if(m<.025)paint=vec3(1.,.96,.79);
                }
                vec3 shaded=paint*(mix(.38,.3,inside)+.6*diffuse)+vec3(specular*.43+soft*.08);
                shaded+=inside*(angle/1.955)*vec3(.16,.13,.07)+isButton*glow*vec3(.07,.05,.01);
                gl_FragColor=vec4(shaded,1.);
            }
        `);
        const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
        const data=[];
        for(const face of buildGeometry())for(let i=1;i<face.vertices.length-1;i++)for(const j of [0,i,i+1]) {
            data.push(...face.vertices[j],...face.normals[j],...materials[face.material].map(n=>n/255),Number(face.lid),Number(face.material==='inner'),Number(face.material==='button'));
        }
        const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
        let offset=0;
        for(const [name,size] of [['position',3],['normal',3],['baseColor',3],['lid',1],['interior',1],['button',1]]) {
            const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,48,offset*4);offset+=size;
        }
        const angleUniform=gl.getUniformLocation(program,'angle'),glowUniform=gl.getUniformLocation(program,'glow');
        gl.uniform1f(gl.getUniformLocation(program,'masterBall'),master?1:0);
        gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
        let frame=null,openedAt=null,pulsedAt=null,disposed=false;
        const clamp=x=>Math.max(0,Math.min(1,x));
        function draw(angle,glow) {
            gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(angleUniform,angle);gl.uniform1f(glowUniform,glow);gl.drawArrays(gl.TRIANGLES,0,data.length/12);
        }
        function tick(now) {
            if(disposed)return;
            const progress=openedAt===null?0:clamp((now-openedAt)/1300),pulse=pulsedAt===null?1:clamp((now-pulsedAt)/500);
            const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
            draw(eased*1.955,Math.sin(pulse*Math.PI));
            frame=((openedAt!==null&&progress<1)||pulse<1)?root.requestAnimationFrame(tick):null;
        }
        function schedule(){if(frame===null)frame=root.requestAnimationFrame(tick);}
        draw(0,0);
        return {open(){openedAt=root.performance.now();schedule();},pulse(){pulsedAt=root.performance.now();schedule();},dispose(){disposed=true;if(frame!==null)root.cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);}};
    }
    const api={rotateLid,buildGeometry,mount};root.PokemonBall=api;
    if(typeof module!=='undefined')module.exports=api;
})(globalThis);
