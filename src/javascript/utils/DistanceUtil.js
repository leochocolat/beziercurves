class DistanceUtil {
    getDistance(point1, point2) {
        let a = point1.x - point2.x;
        let b = point1.y - point2.y;
        
        return { x: a, y: b };
    }

    getAbsoluteDistance(point1, point2) {
        let a = point1.x - point2.x;
        let b = point1.y - point2.y;
        
        let distance = Math.sqrt(a * a + b * b);

        return distance;
    }
}

export default new DistanceUtil();