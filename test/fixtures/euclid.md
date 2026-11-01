# The inscribed angle

Few results in plane geometry repay so little effort so generously. Pick any arc of a circle. The angle it subtends at the centre is exactly twice the angle it subtends anywhere on the far side of the circumference.

:::theorem Inscribed angle
If $A$, $B$ and $C$ lie on a circle with centre $O$, then $\angle AOB = 2\,\angle ACB$.
:::

```figure
{"width":380,"height":340,"xRange":[-1.5,1.5],"yRange":[-1.35,1.35],"caption":"The central angle is twice the inscribed angle on the same arc.","elements":[{"type":"circle","center":[0,0],"radius":1,"color":"ink"},{"type":"point","at":[0,0],"label":"O","label_offset":[0,-12]},{"type":"point","at":[0.866,-0.5],"label":"A","label_offset":[12,10]},{"type":"point","at":[-0.866,-0.5],"label":"B","label_offset":[-14,10]},{"type":"point","at":[0.2,0.98],"label":"C","label_offset":[6,-12]},{"type":"polygon","points":["O","A","B"],"fill":"accent2","fill_opacity":0.25},{"type":"polygon","points":["C","A","B"],"fill":"accent3","fill_opacity":0.18},{"type":"angle","at":"O","from":"B","to":"A","radius":24,"color":"accent","label":"2\\theta"},{"type":"angle","at":"C","from":"B","to":"A","radius":30,"color":"accent","label":"\\theta"}]}
```

## Why it is true

The proof turns on one observation: a radius drawn to a point on the circle makes an isosceles triangle. Draw the diameter through $C$. It splits the figure into two such triangles, and in each the exterior angle at $O$ equals the sum of the two equal base angles.

:::proof
Let $CO$ meet the circle again at $D$. Triangle $OAC$ is isosceles, so $\angle OAC = \angle OCA = \alpha$, and the exterior angle is $\angle AOD = 2\alpha$. Likewise $\angle BOD = 2\beta$. Adding gives

$$\angle AOB = 2(\alpha + \beta) = 2\,\angle ACB.$$
:::

The corollary everyone remembers follows at once: an angle inscribed in a semicircle is a right angle, because the central angle is then a straight line of $180^\circ$.

```figure
{"width":460,"height":230,"xRange":[-6.3,6.3],"yRange":[-1.4,1.4],"aspect":"stretch","axes":true,"caption":"Projecting a point moving round the circle gives $\\sin x$ and $\\cos x$.","elements":[{"type":"curve","y":"sin(x)","domain":[-6.28,6.28]},{"type":"curve","y":"cos(x)","domain":[-6.28,6.28]}]}
```

# Exercises

:::steps
- Thales | Show that the angle in a semicircle is $90^\circ$ directly from the theorem.
- Cyclic quadrilaterals | Prove that opposite angles of a cyclic quadrilateral sum to $180^\circ$.
- Tangents | Show that the angle between a tangent and a chord equals the inscribed angle on the opposite arc.
:::

# Further reading

Byrne's 1847 edition of Euclid replaced letters with colours, and it still looks modern. The palette of this document is a quiet nod to it.
